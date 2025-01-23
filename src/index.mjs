import { Command } from "commander";
import { startServer } from "./server.mjs"
import { exportTiles } from "./export.mjs";

const program = new Command();

program.name('c-tiles');

program.command('serve', { isDefault: true })
    .description('Start city names vector data tile server')
    .option('-p,--port <port_number>', 'web port', '8089')
    .option('-h,--host', 'Server host', 'localhost')
    .option('-d,--data', 'Data file')
    .action((options) => {
        startServer(options);
    });

program.command('export')
    .description('Export tileset as files')
    .option('-d,--data', 'Data file')
    .action((options) => {
        exportTiles(options)
    });

program.parse();