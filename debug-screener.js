const cheerio = require('cheerio');

async function test() {
    const res = await fetch('https://www.screener.in/company/TCS/consolidated/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log('=== ALL SECTION IDs ===');
    $('section').each((i, el) => {
        const id = $(el).attr('id');
        if (id) console.log('  section#' + id);
    });
    
    console.log('\n=== MARKET LINKS (first 5) ===');
    let count = 0;
    $('a[href*="/market/"]').each((i, el) => {
        if (count++ < 5) console.log('  ' + $(el).text().trim() + ' -> ' + $(el).attr('href'));
    });
    
    console.log('\n=== PEER COMPARISON SECTION ===');
    const pc = $('section#peer-comparison');
    console.log('Found section#peer-comparison: ' + pc.length);
    if (pc.length) {
        console.log('Has table: ' + pc.find('table').length);
        console.log('Has table tbody tr: ' + pc.find('table tbody tr').length);
        console.log('Section text (first 400 chars): ' + pc.text().substring(0, 400));
    }
    
    console.log('\n=== ALL ELEMENTS WITH IDs ===');
    $('[id]').each((i, el) => {
        const id = $(el).attr('id');
        const tag = el.type === 'tag' ? el.name : '??';
        if (id && !id.startsWith('_') && id.length < 30) console.log('  ' + tag + '#' + id);
    });

    console.log('\n=== TOP RATIOS ===');
    $('#top-ratios li').each((i, el) => {
        const name = $(el).find('.name').text().trim();
        const value = $(el).find('.value, .number').text().trim();
        if (name) console.log('  ' + name + ' = ' + value);
    });

    console.log('\n=== QUARTERS TABLE HEADERS ===');
    const qSection = $('section#quarters, #quarters');
    console.log('Found quarters section: ' + qSection.length);
    if (qSection.length) {
        const headers = [];
        qSection.find('table thead th, table thead td').each((i, th) => headers.push($(th).text().trim()));
        console.log('Headers: ' + JSON.stringify(headers));
    }
}

test().catch(console.error);
