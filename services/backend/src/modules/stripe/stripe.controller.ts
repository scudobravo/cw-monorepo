import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import type { Session as CheckoutSession } from 'stripe/cjs/resources/Checkout/Sessions';
import type { Subscription } from 'stripe/cjs/resources/Subscriptions';
import type { Invoice } from 'stripe/cjs/resources/Invoices';

@Controller('webhooks')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private readonly stripeService: StripeService) {}

  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    if (!sig) throw new BadRequestException('Missing stripe-signature header');

    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    // Let TypeScript infer the event type from constructEvent's return type
    let event: ReturnType<typeof this.stripeService.stripe.webhooks.constructEvent>;
    try {
      event = this.stripeService.stripe.webhooks.constructEvent(
        rawBody,
        sig,
        this.stripeService.webhookSecret,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook signature verification failed: ${msg}`);
      throw new BadRequestException(`Webhook Error: ${msg}`);
    }

    this.logger.log(`Stripe event received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.stripeService.handleCheckoutCompleted(
          event.data.object as CheckoutSession,
        );
        break;

      case 'customer.subscription.deleted':
        await this.stripeService.handleSubscriptionDeleted(
          event.data.object as Subscription,
        );
        break;

      case 'customer.subscription.updated':
        await this.stripeService.handleSubscriptionUpdated(
          event.data.object as Subscription,
        );
        break;

      case 'invoice.payment_failed':
        await this.stripeService.handleInvoicePaymentFailed(
          event.data.object as Invoice,
        );
        break;

      default:
        break;
    }

    return { received: true };
  }
}
