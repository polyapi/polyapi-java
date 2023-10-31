import { MigrationContext } from 'migration/types';
import { default as changeResponseToResponseType1688365733 } from './1688365733_change_response_to_response_type';
import { default as hashApiKeys1694673436235 } from './1694673436235_hash_api_keys';
import { default as changeEventPayloadToType1695795515232 } from './1695795515232_change_event_payload_to_type';
import { default as webhookSecurityFunctions1695969533734 } from './1695969533734_webhook-security-functions';
import { default as webhookSecurityFunctionsRelationship1698071653657 } from './1698071653657_webhook-security-functions-relationship';

export type Migration = {
    name: string;
    run: (context: MigrationContext) => Promise<void>;
}

export default [changeResponseToResponseType1688365733, hashApiKeys1694673436235, changeEventPayloadToType1695795515232, webhookSecurityFunctions1695969533734, webhookSecurityFunctionsRelationship1698071653657] as Migration[];
