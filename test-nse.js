const { NseIndia } = require('stock-nse-india');
const nse = new NseIndia();

(async () => {
    try {
        // Test board meeting endpoints
        console.log('=== BOARD MEETINGS BROAD ===');
        const bmUrls = [
            '/api/corporate-board-meetings?index=equities',
            '/api/corporates-boardMeetings?index=equities',
            '/api/corporates-board-meetings?index=equities',
            '/api/corporates-boardMeeting?index=equities',
        ];

        for (const url of bmUrls) {
            try {
                const data = await nse.getDataByEndpoint(url);
                const arr = Array.isArray(data) ? data : (data?.data || []);
                console.log(`OK: ${url}`);
                console.log(`  count=${arr.length}`);
                if (arr.length > 0) {
                    console.log('  Keys:', Object.keys(arr[0]).join(', '));
                    console.log('  First:', JSON.stringify(arr[0]).substring(0, 300));
                    console.log('  Second:', JSON.stringify(arr[1]).substring(0, 300));
                }
            } catch (e) {
                console.log(`FAIL: ${url} => ${e.message?.substring(0, 60)}`);
            }
        }

        // Test insider trading alternatives
        console.log('\n=== INSIDER TRADING ALTERNATIVES ===');
        const inUrls = [
            '/api/corporates-insider?index=equities',
            '/api/corporates-insiderTrading?index=equities',
            '/api/insider-trading?index=equities',
            '/api/corporates-insider-trading?index=equities',
            '/api/corporates-pledgedata?index=equities&symbol=RELIANCE',
            '/api/corporates-pledgedata?index=equities',
        ];

        for (const url of inUrls) {
            try {
                const data = await nse.getDataByEndpoint(url);
                const arr = Array.isArray(data) ? data : (data?.data || []);
                console.log(`OK: ${url}`);
                console.log(`  count=${arr.length}`);
                if (arr.length > 0) {
                    console.log('  Keys:', Object.keys(arr[0]).join(', '));
                    console.log('  First:', JSON.stringify(arr[0]).substring(0, 300));
                }
            } catch (e) {
                console.log(`FAIL: ${url} => ${e.message?.substring(0, 60)}`);
            }
        }

        // Test broad corporate actions — can we filter by multiple symbols?
        console.log('\n=== BROAD CORPORATE ACTIONS (today + future) ===');
        try {
            const now = new Date();
            const future = new Date(now.getTime() + 90 * 86400000);
            const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
            const fromDate = fmtDate(now);
            const toDate = fmtDate(future);
            console.log(`  from=${fromDate} to=${toDate}`);
            const url = `/api/corporates-corporateActions?index=equities&from_date=${fromDate}&to_date=${toDate}`;
            const data = await nse.getDataByEndpoint(url);
            const arr = Array.isArray(data) ? data : [];
            console.log(`  Count: ${arr.length}`);
            arr.slice(0, 5).forEach((a, i) => {
                console.log(`  [${i}] symbol=${a.symbol} exDate=${a.exDate} subject=${a.subject?.substring(0, 60)}`);
            });
        } catch (e) {
            console.log(`  FAIL: ${e.message?.substring(0, 80)}`);
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    }
})();
