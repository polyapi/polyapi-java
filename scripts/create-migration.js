const fs = require('fs');
const path = require('path');


const migrationFiles = fs.readdirSync(path.join(process.cwd(), 'src/migration/migrations'))
      .filter(file => file !== 'index.ts' && file.endsWith('.ts'))
      .map(file => file.replace('.ts', ''));


const toCamelCase = (value) => value.replace(/[_|-]([a-z])/g, (match) => {
  return match[1].toUpperCase();
});

const getMigrationName = value => {
  const match = value.match(/([0-9]+)[_|-](.*)$/)
  return `${match[2]}${match[1]}`
};


// Get filename from command line arguments
const [, , filename] = process.argv;

if (!filename) {
  console.error('Please provide a filename.');
  return process.exit(1);
}

if(!filename.match(/^[\w-]+$/)) {
  console.error('Migration file can only contain letters, numbers, hyphens and underscore symbols.');
  return process.exit(1);
}

// Create the full filename with timestamp
const timestamp = Date.now();
const fullFilename = `${timestamp}_${filename}.ts`;


migrationFiles.push(fullFilename.replace('.ts', ''));

// Index file contents to export all migrations.
const indexContent = `import { MigrationContext } from 'migration/types';
${migrationFiles.reduce((acum, file) => `${acum}import { default as ${toCamelCase(getMigrationName(file))} } from './${file}';\n`, '')}
export type Migration = {
    name: string;
    run: (context: MigrationContext) => Promise<void>;
}

export default [${migrationFiles.reduce((acum, file, currentIdx) => {

  const lastFile = currentIdx === migrationFiles.length - 1

  return `${acum}${toCamelCase(getMigrationName(file))}${!lastFile ? ', ' : ''}`
}, '')}] as Migration[];
`;

// Migration file content.
const fileContent = `import { MigrationContext } from 'migration/types';

export default {
  async run({ }: MigrationContext): Promise<void> {
    // Write your migration code here
  },
  name: '${fullFilename.replace('.ts', '')}',
};

`;


// Path where you want to save the migration files
const migrationsDir = path.join(__dirname, '../src/migration/migrations');

// Ensure the directory exists
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir);
}

// Create the file
fs.writeFileSync(path.join(migrationsDir, fullFilename), fileContent, 'utf8');

// Update index.ts
fs.writeFileSync(path.join(migrationsDir, 'index.ts'), indexContent, 'utf8');

console.log(`Migration file created: ${fullFilename}`);
