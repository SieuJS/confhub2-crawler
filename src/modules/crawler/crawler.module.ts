import { Module } from '@nestjs/common';
import { CrawlController } from './controller/crawl.controller';
import { BrowserService } from './service';

@Module({
    controllers: [CrawlController],
    providers: [BrowserService],
    exports: [BrowserService],
})
export class CrawlerModule {

}


