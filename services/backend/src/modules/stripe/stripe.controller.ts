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
import Stripe = require('stripe');
import type { Stripe as StripeTypes } from 'stripe';

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

    let event: StripeTypes.Event;
    try {
      event = this.stripeService.stripe.webhooks.constructEvent(
        rawBody,
        sig,
        this.stripeService.webhookSecret,
      ) as StripeTypes.Event;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook signature verification failed: ${msg}`);
      throw new BadRequestException(`Webhook Error: ${msg}`);
    }

    this.logger.log(`Stripe event received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.stripeService.handleCheckoutCompleted(
          event.data.object as StripeTypes.Checkout.Session,
        );
        break;

      case 'customer.subscription.deleted':
        await this.stripeService.handleSubscriptionDeleted(
          event.data.object as StripeTypes.Subscription,
        );
        break;

      case 'customer.subscription.updated':
        await this.stripeService.handleSubscriptionUpdated(
          event.data.object as StripeTypes.Subscription,
        );
        break;

      case 'invoice.payment_failed':
        await this.stripeService.handleInvoicePaymentFailed(
          event.data.object as StripeTypes.Invoice,
        );
        break;

      default:
        // Ignore unhandled event types
        break;
    }

    return { received: true };
  }
}
