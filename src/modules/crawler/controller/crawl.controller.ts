import { Controller, Get } from '@nestjs/common';
import { BrowserService } from '../service';


@Controller('crawl')
export class CrawlController {
    public constructor(
        private readonly browserService : BrowserService
    ) {
    }

    @Get('/crawl')
    public async crawl() {
        const afterCrawl =  await this.browserService.init();
        return afterCrawl;
    }
}