const Stripe = require('stripe');
try {
    const stripe = new Stripe('sk_test_dummy', {
        apiVersion: '2026-02-25.clover',
        typescript: true,
    });
    console.log('Success creating Stripe client');
} catch (e) {
    console.error('Error creating Stripe client:', e.message);
}
