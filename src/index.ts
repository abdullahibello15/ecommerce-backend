import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\nAvailable routes:`);
  console.log(`  POST   /api/auth/register`);
  console.log(`  POST   /api/auth/login`);
  console.log(`  POST   /api/auth/refresh`);
  console.log(`  GET    /api/analytics/revenue`);
  console.log(`  GET    /api/analytics/gateways`);
  console.log(`  GET    /api/analytics/kpis`);
  console.log(`  GET    /api/transactions`);
  console.log(`  GET    /api/transactions/export`);
  console.log(`  GET    /api/transactions/:reference`);
  console.log(`  GET    /api/gateways`);
  console.log(`  PUT    /api/gateways/:id`);
  console.log(`  GET    /api/gateways/:id/logs`);
  console.log(`  GET    /api/webhooks/endpoints`);
  console.log(`  POST   /api/webhooks/endpoints`);
  console.log(`  POST   /api/payments/initialize`);
  console.log(`  GET    /api/notifications`);
  console.log(`  GET    /api/search`);
  console.log(`  GET    /api/team`);
  console.log(`  POST   /api/team/invite`);
  console.log(`  GET    /api/billing/plan`);
  console.log(`  POST   /api/contact`);
});
