/* eslint-disable no-console */
import * as playwright from 'playwright';
import { ConferenceData } from '../model';

import { searchConferenceLinks, saveHTMLContent } from '../utils';
import { callGeminiAPI } from '../utils/send-to-model';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const allConferences: ConferenceData[] = [
    {
        name: 'The 2022 ACM International Conference on Management of Data',
        acronym: 'ACM',
    } as ConferenceData,
    {
        name: 'The CITA',
        acronym: 'CITA',
    } as ConferenceData,


];

export class BrowserService {
    public constructor(
        private browser: playwright.Browser
    ) { }

    public async init() {
        let totalContent = '';

        this.browser = await playwright.chromium.launch({
            executablePath: EDGE_PATH,
            args: [
                '--disable-notifications',
                '--disable-geolocation',
                '--disable-extensions',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--blink-settings=imagesEnabled=false',
            ],
        });

            for (const conference of allConferences) {
                console.log(`Crawling data for conference: ${conference.acronym}`);
                const links = await searchConferenceLinks(this.browser, conference);
                if (links.length > 0) {
                    const content  = await saveHTMLContent(this.browser, conference, links);
                    totalContent += content?.conferenceText as string;
                }
            }
            console.log('html to text ' , totalContent);
            const responseText = await callGeminiAPI(totalContent);
            return responseText;
            // console.log(responseText);
    }
}
