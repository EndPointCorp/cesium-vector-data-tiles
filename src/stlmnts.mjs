import fs from 'fs';
import { parse } from 'csv-parse';
import { QTree } from './qtree.mjs';

export async function readData(filePath) {

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
    
    const scoreF = (cty) => {
        return cty.ppl;
    };

    const tree = new QTree({scoreF, minDepth: 3});
    
    for await (const row of rowsAsync) {
        const id = parseInt(row[ID_FLD]);
        const name = row[ASCII_NAME_FLD];
        const cls = row[CLASS_FLD];
        const clazz = row[CLASS_CODE_FLD];
        
        const lat = parseFloat(row[LAT_FLD]);
        const lon = parseFloat(row[LON_FLD]);
        const ele = parseInt(row[ELE_FLD] || 0);
    
        const ppl = parseInt(row[PPL_FLD] || 0);
    
        const node = {
            id, clazz, name,
            lat, lon, ele, ppl
        };
    
        if (cls === 'P') {
            tree.insert(node);
        }
    }
    
    return tree;
}
