import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe = require('stripe');
import type { Session as CheckoutSession } from 'stripe/cjs/resources/Checkout/Sessions';
import type { Subscription } from 'stripe/cjs/resources/Subscriptions';
import type { Invoice } from 'stripe/cjs/resources/Invoices';
import type { Customer } from 'stripe/cjs/resources/Customers';

type StripeClient = InstanceType<typeof Stripe>;

type Product = 'DevOracle' | 'RingWise';
type Plan = 'pro' | 'ringwise_pro' | 'ringwise_team' | 'interview_pass';

const PASS_DURATION_DAYS = 30;

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly supabase: SupabaseClient;
  readonly stripe: StripeClient;
  readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('supabase.url')!,
      this.config.get<string>('supabase.serviceRoleKey')!,
    );

    const stripeKey = this.config.get<string>('stripe.secretKey');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not configured');
    this.stripe = new Stripe(stripeKey);

    this.webhookSecret = this.config.get<string>('stripe.webhookSecret') ?? '';
  }

  // ── Checkout completed ────────────────────────────────────────

  async handleCheckoutCompleted(session: CheckoutSession) {
    const email = session.customer_email ?? await this.getCustomerEmail(session.customer as string);
    if (!email) {
      this.logger.warn(`checkout.session.completed: no email for session ${session.id}`);
      return;
    }

    const product = session.metadata?.['product'] as Product | undefined;
    const plan = session.metadata?.['plan'] as Plan | undefined;

    if (!product || !plan) {
      this.logger.warn(`checkout.session.completed: missing metadata on session ${session.id}`);
      return;
    }

    const stripeCustomerId = session.customer as string;

    if (plan === 'interview_pass') {
      // One-time payment — no subscription ID
      await this.provisionInterviewPass(email, product, stripeCustomerId);
    } else {
      await this.provisionSubscription(
        email,
        product,
        plan,
        stripeCustomerId,
        session.subscription as string,
      );
    }
  }

  // ── Interview Pass (one-time payment) ────────────────────────

  private async provisionInterviewPass(
    email: string,
    product: Product,
    stripeCustomerId: string,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PASS_DURATION_DAYS);

    const { data: existing } = await this.supabase
      .from('profiles')
      .select('id, plan, pass_expires_at')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      // Existing user — reset/extend pass
      await this.supabase
        .from('profiles')
        .update({
          plan: 'interview_pass',
          pass_expires_at: expiresAt.toISOString(),
          pass_minutes_used: 0,
          stripe_customer_id: stripeCustomerId,
          subscription_status: 'active',
        })
        .eq('id', existing.id);

      this.logger.log(`Interview Pass renewed: ${email} (expires ${expiresAt.toISOString()})`);
      return;
    }

    // New user
    const redirectTo = product === 'DevOracle'
      ? 'https://devoracle.com/download'
      : 'https://ringwise.uk/download';

    const { data: invited, error } = await this.supabase.auth.admin.inviteUserByEmail(email, {
      data: { product, plan: 'interview_pass' },
      redirectTo,
    });

    if (error || !invited.user) {
      this.logger.error(`Failed to invite pass user ${email}: ${error?.message}`);
      throw new Error(error?.message ?? 'invite failed');
    }

    await this.supabase.from('profiles').insert({
      id: invited.user.id,
      email,
      product,
      products: [product],
      plan: 'interview_pass',
      tokens_limit: 0,
      tokens_used: 0,
      pass_expires_at: expiresAt.toISOString(),
      pass_minutes_used: 0,
      stripe_customer_id: stripeCustomerId,
      subscription_status: 'active',
    });

    this.logger.log(`Interview Pass provisioned for new user: ${email}`);
  }

  // ── Subscription (recurring) ──────────────────────────────────

  private async provisionSubscription(
    email: string,
    product: Product,
    plan: Plan,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ) {
    const { data: planRow } = await this.supabase
      .from('plans')
      .select('tokens_monthly')
      .eq('id', plan)
      .maybeSingle();

    const tokensLimit = planRow?.tokens_monthly ?? 500_000;

    const resetAt = new Date();
    resetAt.setMonth(resetAt.getMonth() + 1);
    resetAt.setDate(1);
    resetAt.setHours(0, 0, 0, 0);

    const { data: existing } = await this.supabase
      .from('profiles')
      .select('id, product, products')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      const alreadyHasProduct =
        existing.product === product ||
        (existing.products ?? []).includes(product);

      const updatedProducts = alreadyHasProduct
        ? (existing.products ?? [existing.product])
        : [...(existing.products ?? [existing.product]), product];

      await this.supabase
        .from('profiles')
        .update({
          plan,
          tokens_limit: tokensLimit,
          tokens_used: 0,
          products: updatedProducts,
          // Clear any leftover pass state
          pass_expires_at: null,
          pass_minutes_used: 0,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: 'active',
          usage_reset_at: resetAt.toISOString(),
        })
        .eq('id', existing.id);

      this.logger.log(`Subscription provisioned: ${email} → ${product} ${plan}`);
      return;
    }

    // New user
    const redirectTo = product === 'DevOracle'
      ? 'https://devoracle.com/download'
      : 'https://ringwise.uk/download';

    const { data: invited, error } = await this.supabase.auth.admin.inviteUserByEmail(email, {
      data: { product, plan },
      redirectTo,
    });

    if (error || !invited.user) {
      this.logger.error(`Failed to invite user ${email}: ${error?.message}`);
      throw new Error(error?.message ?? 'invite failed');
    }

    await this.supabase.from('profiles').insert({
      id: invited.user.id,
      email,
      product,
      products: [product],
      plan,
      tokens_limit: tokensLimit,
      tokens_used: 0,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: 'active',
      usage_reset_at: resetAt.toISOString(),
    });

    this.logger.log(`New user provisioned: ${email} → ${product} ${plan}`);
  }

  // ── Subscription deleted → downgrade to free ─────────────────

  async handleSubscriptionDeleted(subscription: Subscription) {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id, email')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (!profile) {
      this.logger.warn(`subscription.deleted: no profile for sub ${subscription.id}`);
      return;
    }

    await this.supabase
      .from('profiles')
      .update({
        plan: 'free',
        tokens_limit: 0,
        subscription_status: 'cancelled',
        stripe_subscription_id: null,
      })
      .eq('id', profile.id);

    this.logger.log(`Subscription cancelled: ${profile.email} → free`);
  }

  // ── Subscription updated → sync status ───────────────────────

  async handleSubscriptionUpdated(subscription: Subscription) {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id, email')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (!profile) return;

    await this.supabase
      .from('profiles')
      .update({ subscription_status: subscription.status })
      .eq('id', profile.id);

    this.logger.log(`Subscription updated: ${profile.email} → ${subscription.status}`);
  }

  // ── Invoice payment failed → past_due ────────────────────────

  async handleInvoicePaymentFailed(invoice: Invoice) {
    // Stripe v22: subscription reference moved to invoice.parent.subscription_details.subscription
    const subRef = invoice.parent?.subscription_details?.subscription;
    const subId = typeof subRef === 'string' ? subRef : subRef?.id;
    if (!subId) return;

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id, email')
      .eq('stripe_subscription_id', subId)
      .maybeSingle();

    if (!profile) return;

    await this.supabase
      .from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('id', profile.id);

    this.logger.warn(`Payment failed: ${profile.email} → past_due`);
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async getCustomerEmail(customerId: string): Promise<string | null> {
    if (!customerId) return null;
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) return null;
      return (customer as Customer).email ?? null;
    } catch {
      return null;
    }
  }
}
