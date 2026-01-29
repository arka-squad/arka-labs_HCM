#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();
const hcmRoot = process.env.HCM_ROOT || path.join(process.cwd(), 'hcm');

program
  .name('hcm')
  .description('CLI for Arka Hybrid Collective Memory')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new HCM structure in the current directory')
  .action(async () => {
    console.log(`Initializing HCM at ${hcmRoot}...`);
    try {
        // Simple scaffolding logic
        const dirs = ['stable', 'domain', 'state/missions', 'state/team', 'hindex'];
        for (const dir of dirs) {
            const p = path.join(hcmRoot, dir);
            if (!fs.existsSync(p)) {
                fs.mkdirSync(p, { recursive: true });
                console.log(`Created ${dir}`);
            }
        }
        
        const metaPath = path.join(hcmRoot, 'meta.json');
        if (!fs.existsSync(metaPath)) {
             fs.writeFileSync(metaPath, JSON.stringify({
                 hcm_version: "1.0.0",
                 created_at: new Date().toISOString()
             }, null, 2));
             console.log('Created meta.json');
        }

        console.log('HCM Initialization Complete.');
    } catch (err: any) {
        console.error('Init failed:', err.message);
        process.exit(1);
    }
  });

program
  .command('check')
  .description('Validate HCM structure and meta.json')
  .action(async () => {
    console.log(`Checking HCM at ${hcmRoot}...`);
    try {
        const metaPath = path.join(hcmRoot, 'meta.json');
        if (!fs.existsSync(metaPath)) {
            console.error('FAIL: meta.json missing. Is this an HCM root?');
            process.exit(1);
        }
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        console.log(`PASS: Found HCM v${meta.hcm_version}`);
        // Can add more checks here
    } catch (err: any) {
         console.error('Check failed:', err.message);
         process.exit(1);
    }
  });

program
  .command('list')
  .argument('<resource>', 'missions | agents')
  .description('List resources from the collective memory')
  .action(async (resource) => {
    if (resource === 'missions') {
        try {
            // Using FsAdapter indirectly via search or direct implementation
            // For CLI v1, we can use search with 'mission_history' class implicity or list dirs
            // Let's rely on listFilesRecursive simulation logic or FsAdapter
            // Or simpler: reading the state/missions directory
            
            const missionsDir = path.join(hcmRoot, 'state/missions');
            if (fs.existsSync(missionsDir)) {
                 const missions = fs.readdirSync(missionsDir).filter(f => fs.statSync(path.join(missionsDir, f)).isDirectory());
                 console.log('--- Active Missions ---');
                 missions.forEach(m => console.log(`- ${m}`));
            } else {
                console.log('No missions found.');
            }
        } catch (err: any) {
            console.error('List failed:', err.message);
        }
    } else {
        console.log(`Listing ${resource} not yet implemented.`);
    }
  });

program.parse(process.argv);
