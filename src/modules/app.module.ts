import { Module } from '@nestjs/common';

import { CommonModule } from './common';
import { CrawlerModule } from './crawler/crawler.module';


@Module({
    imports: [
        CommonModule,
        CrawlerModule
    ]
})
export class ApplicationModule {}
