/* eslint-disable no-console */
import { Browser } from 'playwright';
import { ConferenceData } from '../model' ;


export async function searchConferenceLinks (browser : Browser ,conference : ConferenceData) {
    const maxLinks = 4;
    const links : string[] = [];
    const page = await browser.newPage();
    let timeout; // Biến để kiểm soát timeout

    try {
      // Đặt timeout toàn bộ cho quá trình tìm kiếm
      timeout = setTimeout(() => {
        // console.warn('Search process is taking too long. Closing the page.');
        page.close().catch(() => {throw new Error('Timeout');});
      }, 60000); // 60 giây

      // Truy cập Google
      await page.goto('https://www.google.com/', { waitUntil: 'load', timeout: 60000 });

      // Tìm hộp tìm kiếm và nhập từ khóa
      await page.waitForSelector('#APjFqb', { timeout: 30000 });
      await page.fill('#APjFqb', `${conference.name} ${conference.acronym} 2025`);
      await page.press('#APjFqb', 'Enter');
      await page.waitForSelector('#search');

      const unwantedDomains = [
        'scholar.google',
        'translate.google',
        'google.com',
        'wikicfp.com',
        'dblp.org',
        'medium.com',
        'dl.acm.org',
        'easychair.org',
        'youtube.com',
        'https://portal.core.edu.au/conf-ranks/',
        'facebook.com',
        'amazon.com',
        'wikipedia.org',
        'linkedin.com',
        'springer.com',
        'proceedings.com'
      ];

      // Lấy liên kết
      while (links.length < maxLinks) {
        const newLinks = await page.$$eval('#search a', (elements : HTMLAnchorElement[]): string[] => elements
            .map((el: HTMLAnchorElement) => el.href)
            .filter((href : string) => href && href.startsWith('https://')));

        newLinks.forEach((link : string) => {
          if (
            !links.includes(link) &&
            !unwantedDomains.some((domain) => link.includes(domain)) &&
            links.length < maxLinks
          ) {
            links.push(link);
          }
        });

        if (links.length < maxLinks) {
          await page.keyboard.press('PageDown');
          await page.waitForTimeout(2000);
        } else {
          break;
        }
      }

    } catch (error) {
      // console.error(`Error while searching for conference links: ${error.message}`);
    } finally {
      // Xóa timeout nếu trang kết thúc sớm
      if (timeout) clearTimeout(timeout);

      // Đóng trang
      await page.close();
    }
    return links.slice(0, maxLinks);
};