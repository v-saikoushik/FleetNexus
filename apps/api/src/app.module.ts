import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import * as path from 'node:path';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { VehicleModule } from './modules/vehicles/vehicle.module';
import { CustomerModule } from './modules/customers/customer.module';
import { DriverModule } from './modules/drivers/driver.module';
import { TripModule } from './modules/trips/trip.module';
import { ExpenseModule } from './modules/expenses/expense.module';
import { PaymentModule } from './modules/payments/payment.module';
import { FinanceModule } from './modules/finance/finance.module';
import { BusinessMemoryModule } from './modules/intelligence/business-memory.module';
import { CostIntelligenceModule } from './modules/intelligence/cost-intelligence.module';
import { RouteIntelligenceModule } from './modules/intelligence/route-intelligence.module';
import { SeasonalityModule } from './modules/intelligence/seasonality.module';
import { ForecastingModule } from './modules/intelligence/forecasting.module';
import { LoadProfitabilityModule } from './modules/intelligence/load-profitability.module';
import { DecisionSupportModule } from './modules/intelligence/decision-support.module';
import { OutcomeTrackingModule } from './modules/intelligence/outcome-tracking.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
      validate: validateEnv,
    }),
    // path-to-regexp v8 — NestJS 11 requires named wildcards ({*splat}) instead of the legacy (*) glob.
    LoggerModule.forRoot({
      forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,
        autoLogging: true,
        quietReqLogger: true,
      },
    }),
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    IdentityModule,
    VehicleModule,
    CustomerModule,
    DriverModule,
    TripModule,
    ExpenseModule,
    PaymentModule,
    FinanceModule,
    BusinessMemoryModule,
    CostIntelligenceModule,
    RouteIntelligenceModule,
    SeasonalityModule,
    ForecastingModule,
    LoadProfitabilityModule,
    DecisionSupportModule,
    OutcomeTrackingModule,
  ],
})
export class AppModule {}
