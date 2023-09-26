const fs = require('fs');
const path = require('path');

const fileContent = `import { MigrationContext } from 'migration/types';

export const run = async ({ }: MigrationContext): Promise<void> => {
  // Write your migration code here
};
`;

// Get filename from command line arguments
const [, , filename] = process.argv;

if (!filename) {
  console.error('Please provide a filename.');
  process.exit(1);
}

// Create the full filename with timestamp
const timestamp = Date.now();
const fullFilename = `${timestamp}_${filename}.ts`;

// Path where you want to save the migration files
const migrationsDir = path.join(__dirname, '../src/migration/migrations');

// Ensure the directory exists
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir);
}

// Create the file
fs.writeFileSync(path.join(migrationsDir, fullFilename), fileContent, 'utf8');

console.log(`Migration file created: ${fullFilename}`);
