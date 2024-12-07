/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
            const responseText = await callGeminiAPI(totalContent);
            console.log(responseText);
            const conferenceDetails = responseText.split('\n\n').map(conferenceInfo => {
                const details = conferenceInfo.split('\n').reduce((acc, line) => {
                    const [key, value] = line.split(': ');
                    if (key && value) {
                        const formattedKey = key.trim().replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
                            index === 0 ? match.toLowerCase() : match.toUpperCase()
                        ).replace(/\s+/g, '');
                        if (formattedKey === 'conferenceDates') {
                            const [startAndEndDates, year] = value.split(',');
                            console.log(year);
                            let [startDate, endDate] = startAndEndDates.split('-').map(date => date.trim());
                            const monthOfStartDate = startDate.split(' ')[0];
                            if (endDate.split(' ').length === 1) {
                                endDate = `${monthOfStartDate} ${endDate}, ${year.trim()}`;
                            }
                            startDate = `${startDate}, ${year.trim()}`;
                            acc.startDate = startDate;
                            acc.endDate = endDate;
                        } else {
                            acc[formattedKey] = value.trim();
                        }
                    }
                    return acc;
                }, {} as Record<string, string>);
                return details;
            });

            console.log(conferenceDetails);
            return conferenceDetails;
            // console.log(responseText);
    }
}
