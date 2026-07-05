use odra::casper_types::U512;
use odra::prelude::*;

const STATUS_ACTIVE: u8 = 1;
const STATUS_PAUSED: u8 = 2;
const STATUS_REVOKED: u8 = 3;
const STATUS_PENDING: u8 = 4;
const STATUS_APPROVED: u8 = 5;
const STATUS_REJECTED: u8 = 6;
const STATUS_EXHAUSTED: u8 = 8;
const SCOPE_SINGLE_INTENT: u8 = 1;
const SCOPE_DELEGATED: u8 = 2;

#[odra::odra_error]
pub enum ProxyKeyError {
    AgentNotActive = 1,
    IntentNotFound = 2,
    MandateNotFound = 3,
    NonceAlreadyUsed = 4,
    NotMandateOwner = 5,
    MandateInactive = 6,
    MandateExpired = 7,
    TargetNotAllowed = 8,
    ResourceNotAllowed = 9,
    CapExceeded = 10,
    InsufficientVaultBalance = 11,
    CallerMismatch = 12,
    InvalidAmount = 13,
}

#[odra::event]
pub struct AgentRegistered {
    pub agent: String,
    pub name: String,
    pub capabilities_hash: String,
    pub status: String,
}

#[odra::event]
pub struct IntentStaged {
    pub intent_id: String,
    pub user: String,
    pub agent: String,
    pub target: String,
    pub amount: U512,
    pub resource_hash: String,
    pub nonce: String,
}

#[odra::event]
pub struct VaultDeposited {
    pub user: String,
    pub amount: U512,
}

#[odra::event]
pub struct VaultWithdrawn {
    pub user: String,
    pub amount: U512,
}

#[odra::event]
pub struct IntentApproved {
    pub intent_id: String,
    pub user: String,
}

#[odra::event]
pub struct IntentRejected {
    pub intent_id: String,
    pub user: String,
}

#[odra::event]
pub struct MandateCreated {
    pub mandate_id: String,
    pub user: String,
    pub agent: String,
    pub scope: String,
    pub cap: U512,
    pub target: String,
    pub resource_pattern_hash: String,
    pub expiry_block: u64,
}

#[odra::event]
pub struct MandateRevoked {
    pub mandate_id: String,
    pub user: String,
}

#[odra::event]
pub struct PaymentExecuted {
    pub mandate_id: String,
    pub user: String,
    pub agent: String,
    pub settlement_account: String,
    pub amount: U512,
    pub target: String,
    pub resource_hash: String,
    pub spent: U512,
    pub status: u8,
}

#[odra::event]
pub struct ReceiptRecorded {
    pub receipt_id: String,
    pub intent_id: String,
    pub mandate_id: String,
    pub deploy_hash: String,
    pub amount: U512,
    pub target: String,
    pub resource_hash: String,
    pub result_hash: String,
}

#[odra::module]
pub struct AgentMandates {
    agent_public_keys: Mapping<Address, String>,
    agent_names: Mapping<Address, String>,
    agent_metadata_uris: Mapping<Address, String>,
    agent_capabilities_hashes: Mapping<Address, String>,
    agent_statuses: Mapping<Address, u8>,

    nonce_used: Mapping<String, bool>,
    intent_users: Mapping<String, Address>,
    intent_agents: Mapping<String, Address>,
    intent_targets: Mapping<String, String>,
    intent_actions: Mapping<String, String>,
    intent_amounts: Mapping<String, U512>,
    intent_resource_hashes: Mapping<String, String>,
    intent_payload_hashes: Mapping<String, String>,
    intent_nonces: Mapping<String, String>,
    intent_statuses: Mapping<String, u8>,

    vault_balances: Mapping<Address, U512>,
    mandate_users: Mapping<String, Address>,
    mandate_agents: Mapping<String, Address>,
    mandate_scopes: Mapping<String, u8>,
    mandate_caps: Mapping<String, U512>,
    mandate_spent: Mapping<String, U512>,
    mandate_targets: Mapping<String, String>,
    mandate_resource_pattern_hashes: Mapping<String, String>,
    mandate_expiry_blocks: Mapping<String, u64>,
    mandate_statuses: Mapping<String, u8>,

    receipt_intent_ids: Mapping<String, String>,
    receipt_mandate_ids: Mapping<String, String>,
    receipt_deploy_hashes: Mapping<String, String>,
    receipt_amounts: Mapping<String, U512>,
    receipt_targets: Mapping<String, String>,
    receipt_resource_hashes: Mapping<String, String>,
    receipt_result_hashes: Mapping<String, String>,
}

#[odra::module]
impl AgentMandates {
    pub fn init(&mut self) {}

    pub fn register_agent(
        &mut self,
        agent: Address,
        public_key: String,
        name: String,
        metadata_uri: String,
        capabilities_hash: String,
        status: String,
    ) {
        self.require_caller(agent);
        self.agent_public_keys.set(&agent, public_key);
        self.agent_names.set(&agent, name.clone());
        self.agent_metadata_uris.set(&agent, metadata_uri);
        self.agent_capabilities_hashes
            .set(&agent, capabilities_hash.clone());
        self.agent_statuses
            .set(&agent, Self::agent_status_code(status.clone()));
        self.env().emit_event(AgentRegistered {
            agent: Self::address_string(&agent),
            name,
            capabilities_hash,
            status,
        });
    }

    pub fn stage_intent(
        &mut self,
        intent_id: String,
        user: Address,
        agent: Address,
        target: String,
        action: String,
        amount: U512,
        resource_hash: String,
        payload_hash: String,
        nonce: String,
    ) -> String {
        self.require_caller(agent);
        self.require_active_agent(&agent);

        let nonce_key = Self::nonce_key(&agent, &nonce);
        if self.nonce_used.get_or_default(&nonce_key) {
            self.env().revert(ProxyKeyError::NonceAlreadyUsed);
        }

        self.nonce_used.set(&nonce_key, true);
        self.intent_users.set(&intent_id, user);
        self.intent_agents.set(&intent_id, agent);
        self.intent_targets.set(&intent_id, target.clone());
        self.intent_actions.set(&intent_id, action);
        self.intent_amounts.set(&intent_id, amount);
        self.intent_resource_hashes.set(&intent_id, resource_hash.clone());
        self.intent_payload_hashes.set(&intent_id, payload_hash);
        self.intent_nonces.set(&intent_id, nonce.clone());
        self.intent_statuses.set(&intent_id, STATUS_PENDING);
        self.env().emit_event(IntentStaged {
            intent_id: intent_id.clone(),
            user: Self::address_string(&user),
            agent: Self::address_string(&agent),
            target,
            amount,
            resource_hash,
            nonce,
        });
        intent_id
    }

    #[odra(payable)]
    pub fn deposit(&mut self, user: Address) {
        self.require_caller(user);
        let amount = self.env().attached_value();
        self.require_positive(amount);
        self.vault_balances.add(&user, amount);
        self.env().emit_event(VaultDeposited {
            user: Self::address_string(&user),
            amount,
        });
    }

    pub fn withdraw(&mut self, user: Address, amount: U512) {
        self.require_caller(user);
        self.require_positive(amount);
        let balance = self.vault_balances.get_or_default(&user);
        if balance < amount {
            self.env().revert(ProxyKeyError::InsufficientVaultBalance);
        }
        self.vault_balances.subtract(&user, amount);
        self.env().transfer_tokens(&user, &amount);
        self.env().emit_event(VaultWithdrawn {
            user: Self::address_string(&user),
            amount,
        });
    }

    pub fn approve_intent(&mut self, intent_id: String, user: Address) {
        self.require_caller(user);
        self.require_intent(&intent_id);
        let owner = self
            .intent_users
            .get_or_revert(&intent_id, ProxyKeyError::IntentNotFound);
        if owner != user {
            self.env().revert(ProxyKeyError::NotMandateOwner);
        }
        self.intent_statuses.set(&intent_id, STATUS_APPROVED);
        self.env().emit_event(IntentApproved {
            intent_id,
            user: Self::address_string(&user),
        });
    }

    pub fn reject_intent(&mut self, intent_id: String, user: Address) {
        self.require_caller(user);
        self.require_intent(&intent_id);
        let owner = self
            .intent_users
            .get_or_revert(&intent_id, ProxyKeyError::IntentNotFound);
        if owner != user {
            self.env().revert(ProxyKeyError::NotMandateOwner);
        }
        self.intent_statuses.set(&intent_id, STATUS_REJECTED);
        self.env().emit_event(IntentRejected {
            intent_id,
            user: Self::address_string(&user),
        });
    }

    pub fn create_mandate(
        &mut self,
        mandate_id: String,
        user: Address,
        agent: Address,
        scope: String,
        cap: U512,
        target: String,
        resource_pattern_hash: String,
        expiry_block: u64,
    ) {
        self.require_caller(user);
        self.require_active_agent(&agent);
        self.require_positive(cap);
        self.mandate_users.set(&mandate_id, user);
        self.mandate_agents.set(&mandate_id, agent);
        self.mandate_scopes
            .set(&mandate_id, Self::mandate_scope_code(scope.clone()));
        self.mandate_caps.set(&mandate_id, cap);
        self.mandate_spent.set(&mandate_id, U512::zero());
        self.mandate_targets.set(&mandate_id, target.clone());
        self.mandate_resource_pattern_hashes
            .set(&mandate_id, resource_pattern_hash.clone());
        self.mandate_expiry_blocks.set(&mandate_id, expiry_block);
        self.mandate_statuses.set(&mandate_id, STATUS_ACTIVE);
        self.env().emit_event(MandateCreated {
            mandate_id,
            user: Self::address_string(&user),
            agent: Self::address_string(&agent),
            scope,
            cap,
            target,
            resource_pattern_hash,
            expiry_block,
        });
    }

    pub fn revoke_mandate(&mut self, mandate_id: String, user: Address) {
        self.require_caller(user);
        self.require_mandate(&mandate_id);
        let owner = self
            .mandate_users
            .get_or_revert(&mandate_id, ProxyKeyError::MandateNotFound);
        if owner != user {
            self.env().revert(ProxyKeyError::NotMandateOwner);
        }
        self.mandate_statuses.set(&mandate_id, STATUS_REVOKED);
        self.env().emit_event(MandateRevoked {
            mandate_id,
            user: Self::address_string(&user),
        });
    }

    pub fn execute_payment(
        &mut self,
        mandate_id: String,
        agent: Address,
        settlement_account: Address,
        amount: U512,
        target: String,
        resource_hash: String,
        current_block: u64,
    ) {
        self.require_caller(agent);
        self.require_active_agent(&agent);
        self.require_positive(amount);
        self.require_mandate(&mandate_id);

        let mandate_agent = self
            .mandate_agents
            .get_or_revert(&mandate_id, ProxyKeyError::MandateNotFound);
        if mandate_agent != agent {
            self.env().revert(ProxyKeyError::AgentNotActive);
        }

        if self.mandate_statuses.get_or_default(&mandate_id) != STATUS_ACTIVE {
            self.env().revert(ProxyKeyError::MandateInactive);
        }
        if current_block > self.mandate_expiry_blocks.get_or_default(&mandate_id) {
            self.env().revert(ProxyKeyError::MandateExpired);
        }
        if self.mandate_targets.get_or_default(&mandate_id) != target {
            self.env().revert(ProxyKeyError::TargetNotAllowed);
        }
        if self
            .mandate_resource_pattern_hashes
            .get_or_default(&mandate_id)
            != resource_hash
        {
            self.env().revert(ProxyKeyError::ResourceNotAllowed);
        }

        let cap = self.mandate_caps.get_or_default(&mandate_id);
        let spent = self.mandate_spent.get_or_default(&mandate_id);
        let next_spent = spent + amount;
        if next_spent > cap {
            self.env().revert(ProxyKeyError::CapExceeded);
        }

        let user = self
            .mandate_users
            .get_or_revert(&mandate_id, ProxyKeyError::MandateNotFound);
        let balance = self.vault_balances.get_or_default(&user);
        if balance < amount {
            self.env().revert(ProxyKeyError::InsufficientVaultBalance);
        }

        self.vault_balances.subtract(&user, amount);
        self.env().transfer_tokens(&settlement_account, &amount);
        self.mandate_spent.set(&mandate_id, next_spent);
        let mut status = STATUS_ACTIVE;
        if next_spent == cap
            || self.mandate_scopes.get_or_default(&mandate_id) == SCOPE_SINGLE_INTENT
        {
            self.mandate_statuses.set(&mandate_id, STATUS_EXHAUSTED);
            status = STATUS_EXHAUSTED;
        }
        self.env().emit_event(PaymentExecuted {
            mandate_id,
            user: Self::address_string(&user),
            agent: Self::address_string(&agent),
            settlement_account: Self::address_string(&settlement_account),
            amount,
            target,
            resource_hash,
            spent: next_spent,
            status,
        });
    }

    pub fn record_receipt(
        &mut self,
        receipt_id: String,
        intent_id: String,
        mandate_id: String,
        deploy_hash: String,
        amount: U512,
        target: String,
        resource_hash: String,
        result_hash: String,
    ) {
        self.require_mandate(&mandate_id);
        let agent = self
            .mandate_agents
            .get_or_revert(&mandate_id, ProxyKeyError::MandateNotFound);
        self.require_caller(agent);
        self.receipt_intent_ids.set(&receipt_id, intent_id.clone());
        self.receipt_mandate_ids.set(&receipt_id, mandate_id.clone());
        self.receipt_deploy_hashes.set(&receipt_id, deploy_hash.clone());
        self.receipt_amounts.set(&receipt_id, amount);
        self.receipt_targets.set(&receipt_id, target.clone());
        self.receipt_resource_hashes.set(&receipt_id, resource_hash.clone());
        self.receipt_result_hashes.set(&receipt_id, result_hash.clone());
        self.env().emit_event(ReceiptRecorded {
            receipt_id,
            intent_id,
            mandate_id,
            deploy_hash,
            amount,
            target,
            resource_hash,
            result_hash,
        });
    }

    pub fn agent_status(&self, agent: Address) -> u8 {
        self.agent_statuses.get_or_default(&agent)
    }

    pub fn intent_status(&self, intent_id: String) -> u8 {
        self.intent_statuses.get_or_default(&intent_id)
    }

    pub fn mandate_status(&self, mandate_id: String) -> u8 {
        self.mandate_statuses.get_or_default(&mandate_id)
    }

    pub fn vault_balance(&self, user: Address) -> U512 {
        self.vault_balances.get_or_default(&user)
    }

    pub fn mandate_spent(&self, mandate_id: String) -> U512 {
        self.mandate_spent.get_or_default(&mandate_id)
    }

    pub fn receipt_result_hash(&self, receipt_id: String) -> String {
        self.receipt_result_hashes.get_or_default(&receipt_id)
    }

    fn require_caller(&self, expected: Address) {
        if self.env().caller() != expected {
            self.env().revert(ProxyKeyError::CallerMismatch);
        }
    }

    fn require_active_agent(&self, agent: &Address) {
        if self.agent_statuses.get_or_default(agent) != STATUS_ACTIVE {
            self.env().revert(ProxyKeyError::AgentNotActive);
        }
    }

    fn require_intent(&self, intent_id: &String) {
        if self.intent_statuses.get(intent_id).is_none() {
            self.env().revert(ProxyKeyError::IntentNotFound);
        }
    }

    fn require_mandate(&self, mandate_id: &String) {
        if self.mandate_statuses.get(mandate_id).is_none() {
            self.env().revert(ProxyKeyError::MandateNotFound);
        }
    }

    fn require_positive(&self, amount: U512) {
        if amount == U512::zero() {
            self.env().revert(ProxyKeyError::InvalidAmount);
        }
    }

    fn agent_status_code(status: String) -> u8 {
        if status == "paused" {
            STATUS_PAUSED
        } else if status == "revoked" {
            STATUS_REVOKED
        } else {
            STATUS_ACTIVE
        }
    }

    fn mandate_scope_code(scope: String) -> u8 {
        if scope == "single-intent" {
            SCOPE_SINGLE_INTENT
        } else {
            SCOPE_DELEGATED
        }
    }

    fn nonce_key(agent: &Address, nonce: &String) -> String {
        format!("{:?}:{}", agent, nonce)
    }

    fn address_string(address: &Address) -> String {
        format!("{:?}", address)
    }
}

trait MappingGetOrRevert<K, V> {
    fn get_or_revert(&self, key: &K, error: ProxyKeyError) -> V;
}

impl<K, V> MappingGetOrRevert<K, V> for Mapping<K, V>
where
    K: odra::casper_types::bytesrepr::ToBytes,
    V: odra::casper_types::bytesrepr::FromBytes + odra::casper_types::CLTyped,
{
    fn get_or_revert(&self, key: &K, error: ProxyKeyError) -> V {
        self.get(key).unwrap_or_revert_with(self, error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostRef, NoArgs};

    fn deploy() -> (odra::host::HostEnv, AgentMandatesHostRef) {
        let env = odra_test::env();
        let contract = AgentMandates::deploy(&env, NoArgs);
        (env, contract)
    }

    fn register_agent(contract: &mut AgentMandatesHostRef, agent: Address) {
        contract.register_agent(
            agent,
            "public-key-agent001".to_string(),
            "RWA Sentinel".to_string(),
            "https://proxykey.app/agents/rwa-sentinel.json".to_string(),
            "hash-capabilities".to_string(),
            "active".to_string(),
        );
    }

    #[test]
    fn registers_and_stages_intent_without_nonce_replay() {
        let (env, mut contract) = deploy();
        let user = env.get_account(1);
        let agent = env.get_account(2);

        env.set_caller(agent);
        register_agent(&mut contract, agent);
        assert!(env.emitted_event(
            &contract,
            AgentRegistered {
                agent: AgentMandates::address_string(&agent),
                name: "RWA Sentinel".to_string(),
                capabilities_hash: "hash-capabilities".to_string(),
                status: "active".to_string(),
            },
        ));
        let intent_id = contract.stage_intent(
            "intent-rwa-001".to_string(),
            user,
            agent,
            "rwa-risk-api".to_string(),
            "fetch-risk-report".to_string(),
            U512::from(2_500_u64),
            "hash-rwa-resource".to_string(),
            "hash-payload".to_string(),
            "nonce-001".to_string(),
        );

        assert_eq!(contract.intent_status(intent_id), STATUS_PENDING);
        assert!(env.emitted_event(
            &contract,
            IntentStaged {
                intent_id: "intent-rwa-001".to_string(),
                user: AgentMandates::address_string(&user),
                agent: AgentMandates::address_string(&agent),
                target: "rwa-risk-api".to_string(),
                amount: U512::from(2_500_u64),
                resource_hash: "hash-rwa-resource".to_string(),
                nonce: "nonce-001".to_string(),
            },
        ));
        assert!(contract
            .try_stage_intent(
                "intent-rwa-002".to_string(),
                user,
                agent,
                "rwa-risk-api".to_string(),
                "fetch-risk-report".to_string(),
                U512::from(2_500_u64),
                "hash-rwa-resource".to_string(),
                "hash-payload".to_string(),
                "nonce-001".to_string(),
            )
            .is_err());
    }

    #[test]
    fn approves_mandate_executes_under_cap_and_records_receipt() {
        let (env, mut contract) = deploy();
        let user = env.get_account(1);
        let agent = env.get_account(2);
        let mandate_id = "mandate-001".to_string();

        env.set_caller(agent);
        register_agent(&mut contract, agent);
        let intent_id = contract.stage_intent(
            "intent-rwa-001".to_string(),
            user,
            agent,
            "rwa-risk-api".to_string(),
            "fetch-risk-report".to_string(),
            U512::from(2_500_u64),
            "hash-rwa-resource".to_string(),
            "hash-payload".to_string(),
            "nonce-001".to_string(),
        );

        env.set_caller(user);
        contract.approve_intent(intent_id.clone(), user);
        contract.with_tokens(U512::from(10_000_u64)).deposit(user);
        assert!(env.emitted_event(
            &contract,
            VaultDeposited {
                user: AgentMandates::address_string(&user),
                amount: U512::from(10_000_u64),
            },
        ));
        contract.create_mandate(
            mandate_id.clone(),
            user,
            agent,
            "delegated".to_string(),
            U512::from(10_000_u64),
            "rwa-risk-api".to_string(),
            "hash-rwa-resource".to_string(),
            100,
        );

        env.set_caller(agent);
        contract.execute_payment(
            mandate_id.clone(),
            agent,
            agent,
            U512::from(2_500_u64),
            "rwa-risk-api".to_string(),
            "hash-rwa-resource".to_string(),
            50,
        );
        contract.record_receipt(
            "receipt-001".to_string(),
            intent_id,
            mandate_id.clone(),
            "deploy-hash".to_string(),
            U512::from(2_500_u64),
            "rwa-risk-api".to_string(),
            "hash-rwa-resource".to_string(),
            "hash-result".to_string(),
        );

        assert_eq!(contract.vault_balance(user), U512::from(7_500_u64));
        assert_eq!(contract.mandate_spent(mandate_id), U512::from(2_500_u64));
        assert!(env.emitted_event(
            &contract,
            PaymentExecuted {
                mandate_id: "mandate-001".to_string(),
                user: AgentMandates::address_string(&user),
                agent: AgentMandates::address_string(&agent),
                settlement_account: AgentMandates::address_string(&agent),
                amount: U512::from(2_500_u64),
                target: "rwa-risk-api".to_string(),
                resource_hash: "hash-rwa-resource".to_string(),
                spent: U512::from(2_500_u64),
                status: STATUS_ACTIVE,
            },
        ));
        assert!(env.emitted_event(
            &contract,
            ReceiptRecorded {
                receipt_id: "receipt-001".to_string(),
                intent_id: "intent-rwa-001".to_string(),
                mandate_id: "mandate-001".to_string(),
                deploy_hash: "deploy-hash".to_string(),
                amount: U512::from(2_500_u64),
                target: "rwa-risk-api".to_string(),
                resource_hash: "hash-rwa-resource".to_string(),
                result_hash: "hash-result".to_string(),
            },
        ));
        assert_eq!(
            contract.receipt_result_hash("receipt-001".to_string()),
            "hash-result".to_string()
        );
    }

    #[test]
    fn blocks_revoked_mandate_execution() {
        let (env, mut contract) = deploy();
        let user = env.get_account(1);
        let agent = env.get_account(2);
        let mandate_id = "mandate-001".to_string();

        env.set_caller(agent);
        register_agent(&mut contract, agent);

        env.set_caller(user);
        contract.with_tokens(U512::from(10_000_u64)).deposit(user);
        contract.create_mandate(
            mandate_id.clone(),
            user,
            agent,
            "delegated".to_string(),
            U512::from(10_000_u64),
            "rwa-risk-api".to_string(),
            "hash-rwa-resource".to_string(),
            100,
        );
        contract.revoke_mandate(mandate_id.clone(), user);

        env.set_caller(agent);
        assert!(contract
            .try_execute_payment(
                mandate_id,
                agent,
                agent,
                U512::from(2_500_u64),
                "rwa-risk-api".to_string(),
                "hash-rwa-resource".to_string(),
                50,
            )
            .is_err());
    }
}
