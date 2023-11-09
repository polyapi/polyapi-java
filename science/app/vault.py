from typing import Optional
import requests
from flask import current_app
from app.log import log


def get_variable_value_from_vault(environment_id: str, variable_id: str) -> Optional[str]:
    # print("Starting variable get...")
    vault_address = current_app.config.get("VAULT_ADDRESS")
    vault_token = current_app.config.get('VAULT_TOKEN')
    if not vault_address or not vault_token:
        return None

    headers = {"X-Vault-Token": vault_token}
    url = f"{vault_address}/v1/{environment_id}/data/{variable_id}"
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        content = resp.json()
        value = content["data"]["data"]['value']
        if value:
            log(f"Using tenant openai api key for environment {environment_id}")
        else:
            log(f"Tried to use tenant openai api key for environment {environment_id} but it was blank!")
        return value
    elif resp.status_code == 404:
        log(f"Failed to get tenant openai api key for environment {environment_id}: 404")
        return None
    else:
        log(f"Failed to get tenant openai api key for environment {environment_id}: {resp.status_code}: {resp.text}")
        return None