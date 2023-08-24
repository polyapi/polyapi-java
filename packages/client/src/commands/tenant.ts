import shell from 'shelljs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createTenantSignUp, resendVerificationCode, verifyTenantSignUp } from '../api';
import { SignUpDto } from '../../../model/src/dto';
import { saveConfig } from '../config';
import { exec as execCommand } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCommand);

export const create = async (instance: string, loadedTenantSignUp = null) => {

  let tenantSignUp: SignUpDto | null = loadedTenantSignUp;

  let credentials: {
    apiKey: string,
    apiBaseUrl: string
  } | null = null;

  const { email, name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Please, enter your email:',
      filter: (value) => value.trim(),
      validate: (url) => {
        return true;
      },
    },
    {
      type: 'input',
      name: 'name',
      message: 'Please, enter your tenant name:',
      filter: (value) => value.trim(),
    },
  ]);

  shell.echo('-n', chalk.rgb(255, 255, 255)('\n\nChecking email...\n\n'));

  try {

    const response = await createTenantSignUp(instance, email, name);

    tenantSignUp = response;

  } catch(err) {
    shell.echo(chalk.red('ERROR\n'));
    if(err.response?.status === 409) {
      shell.echo('Email already in use.\n');
      return create(instance);
    }
    shell.echo('Error during sign up process.\n');
  }

  const verifyTenant = async(retry = false) => {
    if(!retry) {
      shell.echo('A verification code has been sent to your email address', chalk.bold(`(${tenantSignUp.email}),`),'please check your email and enter your verification code. \nIf you didn\'t receive your verification code you can enter "resend" to send it again\n');
    }
  
    const { code } = await inquirer.prompt([
      {
        type: 'input',
        name: 'code',
        message: 'Enter your verification code:',
        filter: value => value.trim(),
        validate: verificationCode => !!verificationCode.length
      }
    ]);
  
    if(code === "resend") {

      try{
        shell.echo('\n\nResending your verification code...\n');

        await resendVerificationCode(instance, tenantSignUp.id);

      } catch(err) {
        shell.echo(chalk.red('ERROR\n'));
        shell.echo(`Error sending verification code to "${tenantSignUp.email}".\n`);
      }

      return verifyTenant();
    }

    shell.echo('-n', chalk.rgb(255, 255, 255)('Verifying your tenant...\n\n'));
  
    try{
      const response = await verifyTenantSignUp(instance, tenantSignUp.id, code);

      shell.echo(chalk.green('Tenant created sucesfully, details:\n'));
      shell.echo(chalk.bold('Instance url:'), response.apiBaseUrl, '\n');
      shell.echo(chalk.bold('Api key:'), response.apiKey, '\n');

      credentials = {
        apiBaseUrl: response.apiBaseUrl,
        apiKey: response.apiKey
      };
    
    }catch(err) {
      shell.echo(chalk.red('ERROR\n'));
      if(err.response?.status === 409) {
        shell.echo('Wrong verification code.\n');
        return verifyTenant(true);
      }
  
      shell.echo('Error during sign up process.\n');
    }

  }

  await verifyTenant();


  const { generate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'generate',
      message: 'Would you like to generate the poly client library?',
    },
  ]);

  if(generate) {
    saveConfig({
      POLY_API_BASE_URL: credentials.apiBaseUrl,
      POLY_API_KEY: credentials.apiKey,
    })
  }

  try {
    shell.echo('Generating your poly client library...\n');
    const result = await exec('npx poly generate');

    console.log(result.stdout);
    shell.echo(chalk.green('Poly client library generated.'));
  } catch (err) {
    shell.echo(chalk.red('ERROR\n'));
    shell.echo('Error generating your poly client library.');
  }
  
};

// segiur con logica expiracion, rate limiting.
// validacion de email
