import { NextResponse } from 'next/server';

export async function GET() {
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  const secretKeyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 20) || 'NOT SET';
  
  return NextResponse.json({
    STRIPE_SUBSCRIPTION_PRICE_ID: priceId || 'NOT SET',
    STRIPE_SECRET_KEY_prefix: secretKeyPrefix,
    timestamp: new Date().toISOString(),
  });
}