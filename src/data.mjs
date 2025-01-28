import fs from 'fs';
import { parse } from 'csv-parse';
import { QTree } from './qtree.mjs';

export function getDataPath(...files) {
    const pth = process.argv[1].split('/').filter(p => p != '');
    pth.pop();
    pth.pop();
    pth.push('data');

    if (files) {
        pth.push(...files);
    }

    return '/' + pth.join('/');
}

export const scoreF = (cty) => {
    return cty.ppl;
};

export async function readData(filePath, onCityNode) {

    const ID_FLD = 0;
    const ASCII_NAME_FLD = 2;
    
    const LAT_FLD = 4;
    const LON_FLD = 5;
    
    const CLASS_FLD = 6;
    const CLASS_CODE_FLD = 7;
    
    const PPL_FLD = 14;
    const ELE_FLD = 15;
    
    const parseOptions = { 
        delimiter: "\t", 
        from_line: 1, 
        skip_records_with_error: true 
    };
    
    const rowsAsync = fs.createReadStream(filePath)
      .pipe(parse(parseOptions));
    
    
    for await (const row of rowsAsync) {
        const id = parseInt(row[ID_FLD]);
        const name = row[ASCII_NAME_FLD];
        const cls = row[CLASS_FLD];
        const clazz = row[CLASS_CODE_FLD];
        
        const lat = parseFloat(row[LAT_FLD]);
        const lon = parseFloat(row[LON_FLD]);
        const ele = parseInt(row[ELE_FLD] || 0);
    
        const ppl = parseInt(row[PPL_FLD] || 0);

        const cityNode = {
            id, clazz, name,
            lat, lon, ele, ppl
        };

        cityNode['size'] = getCitySize(cityNode);

        onCityNode(cityNode, cls);
    }
}

export function getCitySize({clazz, ppl, name}) {
    // Capitals
    if (clazz === 'PPLC') {
        return 10;
    }

    switch (clazz) {
        case 'PPLA': return 9;
        case 'PPL2': return 8;
        case 'PPL3': return 7;
        case 'PPL4': return 6;
        case 'PPL5': return 5;
    }

    const population = ppl || 0;

    if (population >= 1_000_000) {
        return 9;
    }
    
    if (population >= 500_000) {
        return 9;
    }
    
    if (population >= 200_000) {
        return 8;
    }
    
    if (population >= 100_000) {
        return 7;
    }
    
    if (population >= 50_000) {
        return 6;
    }
    
    if (population >= 20_000) {
        return 5;
    }
    
    if (population >= 10_000) {
        return 4;
    }
    
    if (population >= 5_000) {
        return 3;
    }
    
    if (population >= 1_000) {
        return 2;
    }

    return 1;
}
