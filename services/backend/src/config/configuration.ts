export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),

  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },

  upstash: {
    restUrl: process.env.UPSTASH_REDIS_REST_URL!,
    restToken: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
  },
});
