import { Module } from '@nestjs/common';
import { OutcomeTrackingController } from './outcome-tracking.controller';
import { OutcomeTrackingService } from './outcome-tracking.service';

@Module({ controllers: [OutcomeTrackingController], providers: [OutcomeTrackingService] })
export class OutcomeTrackingModule {}
