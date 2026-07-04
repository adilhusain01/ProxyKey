use std::collections::{HashMap, HashSet};
use thiserror::Error;

pub type Account = String;
pub type Hash = String;
pub type Motes = u128;
pub type BlockHeight = u64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentStatus {
    Active,
    Paused,
    Revoked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentProfile {
    pub account_hash: Account,
    pub public_key: String,
    pub name: String,
    pub metadata_uri: String,
    pub capabilities_hash: Hash,
    pub status: AgentStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IntentStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
    Expired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Intent {
    pub id: String,
    pub user: Account,
    pub agent: Account,
    pub target: String,
    pub action: String,
    pub amount: Motes,
    pub resource_hash: Hash,
    pub payload_hash: Hash,
    pub nonce: String,
    pub status: IntentStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MandateScope {
    SingleIntent,
    Delegated,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MandateStatus {
    Active,
    Revoked,
    Exhausted,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Mandate {
    pub id: String,
    pub user: Account,
    pub agent: Account,
    pub scope: MandateScope,
    pub cap: Motes,
    pub spent: Motes,
    pub target: String,
    pub resource_pattern_hash: Hash,
    pub expiry_block: BlockHeight,
    pub status: MandateStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Receipt {
    pub id: String,
    pub intent_id: String,
    pub mandate_id: String,
    pub deploy_hash: Hash,
    pub amount: Motes,
    pub target: String,
    pub resource_hash: Hash,
    pub result_hash: Hash,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ProxyKeyError {
    #[error("agent is not registered or active")]
    AgentNotActive,
    #[error("intent not found")]
    IntentNotFound,
    #[error("mandate not found")]
    MandateNotFound,
    #[error("nonce already used")]
    NonceAlreadyUsed,
    #[error("caller is not mandate owner")]
    NotMandateOwner,
    #[error("mandate is not active")]
    MandateInactive,
    #[error("mandate expired")]
    MandateExpired,
    #[error("target not allowed")]
    TargetNotAllowed,
    #[error("resource not allowed")]
    ResourceNotAllowed,
    #[error("cap exceeded")]
    CapExceeded,
    #[error("insufficient vault balance")]
    InsufficientVaultBalance,
}

#[derive(Default)]
pub struct AgentRegistry {
    agents: HashMap<Account, AgentProfile>,
}

impl AgentRegistry {
    pub fn register_agent(&mut self, agent: AgentProfile) {
        self.agents.insert(agent.account_hash.clone(), agent);
    }

    pub fn active_agent(&self, account: &Account) -> Result<&AgentProfile, ProxyKeyError> {
        let agent = self.agents.get(account).ok_or(ProxyKeyError::AgentNotActive)?;
        match agent.status {
            AgentStatus::Active => Ok(agent),
            AgentStatus::Paused | AgentStatus::Revoked => Err(ProxyKeyError::AgentNotActive),
        }
    }
}

#[derive(Default)]
pub struct IntentInbox {
    intents: HashMap<String, Intent>,
    used_nonces: HashSet<(Account, String)>,
}

impl IntentInbox {
    pub fn stage_intent(
        &mut self,
        registry: &AgentRegistry,
        mut intent: Intent,
    ) -> Result<(), ProxyKeyError> {
        registry.active_agent(&intent.agent)?;
        let nonce_key = (intent.agent.clone(), intent.nonce.clone());
        if self.used_nonces.contains(&nonce_key) {
            return Err(ProxyKeyError::NonceAlreadyUsed);
        }
        intent.status = IntentStatus::Pending;
        self.used_nonces.insert(nonce_key);
        self.intents.insert(intent.id.clone(), intent);
        Ok(())
    }

    pub fn approve_intent(&mut self, intent_id: &str, caller: &Account) -> Result<(), ProxyKeyError> {
        let intent = self
            .intents
            .get_mut(intent_id)
            .ok_or(ProxyKeyError::IntentNotFound)?;
        if &intent.user != caller {
            return Err(ProxyKeyError::NotMandateOwner);
        }
        intent.status = IntentStatus::Approved;
        Ok(())
    }
}

#[derive(Default)]
pub struct MandateVault {
    balances: HashMap<Account, Motes>,
    mandates: HashMap<String, Mandate>,
}

impl MandateVault {
    pub fn deposit(&mut self, user: Account, amount: Motes) {
        *self.balances.entry(user).or_default() += amount;
    }

    pub fn withdraw(&mut self, user: &Account, amount: Motes) -> Result<(), ProxyKeyError> {
        let balance = self.balances.entry(user.clone()).or_default();
        if *balance < amount {
            return Err(ProxyKeyError::InsufficientVaultBalance);
        }
        *balance -= amount;
        Ok(())
    }

    pub fn create_mandate(
        &mut self,
        caller: &Account,
        mandate: Mandate,
    ) -> Result<(), ProxyKeyError> {
        if &mandate.user != caller {
            return Err(ProxyKeyError::NotMandateOwner);
        }
        self.mandates.insert(mandate.id.clone(), mandate);
        Ok(())
    }

    pub fn revoke_mandate(&mut self, caller: &Account, mandate_id: &str) -> Result<(), ProxyKeyError> {
        let mandate = self
            .mandates
            .get_mut(mandate_id)
            .ok_or(ProxyKeyError::MandateNotFound)?;
        if &mandate.user != caller {
            return Err(ProxyKeyError::NotMandateOwner);
        }
        mandate.status = MandateStatus::Revoked;
        Ok(())
    }

    pub fn execute_payment(
        &mut self,
        agent: &Account,
        mandate_id: &str,
        amount: Motes,
        target: &str,
        resource_hash: &str,
        current_block: BlockHeight,
    ) -> Result<(), ProxyKeyError> {
        let mandate = self
            .mandates
            .get_mut(mandate_id)
            .ok_or(ProxyKeyError::MandateNotFound)?;
        if &mandate.agent != agent {
            return Err(ProxyKeyError::AgentNotActive);
        }
        if mandate.status != MandateStatus::Active {
            return Err(ProxyKeyError::MandateInactive);
        }
        if current_block > mandate.expiry_block {
            return Err(ProxyKeyError::MandateExpired);
        }
        if mandate.target != target {
            return Err(ProxyKeyError::TargetNotAllowed);
        }
        if mandate.resource_pattern_hash != resource_hash {
            return Err(ProxyKeyError::ResourceNotAllowed);
        }
        if mandate.spent.saturating_add(amount) > mandate.cap {
            return Err(ProxyKeyError::CapExceeded);
        }
        let balance = self.balances.entry(mandate.user.clone()).or_default();
        if *balance < amount {
            return Err(ProxyKeyError::InsufficientVaultBalance);
        }
        *balance -= amount;
        mandate.spent += amount;
        if mandate.spent == mandate.cap {
            mandate.status = MandateStatus::Exhausted;
        }
        Ok(())
    }

    pub fn balance_of(&self, user: &Account) -> Motes {
        *self.balances.get(user).unwrap_or(&0)
    }
}

#[derive(Default)]
pub struct ReceiptLedger {
    receipts: HashMap<String, Receipt>,
}

impl ReceiptLedger {
    pub fn record_receipt(&mut self, receipt: Receipt) {
        self.receipts.insert(receipt.id.clone(), receipt);
    }

    pub fn get(&self, receipt_id: &str) -> Option<&Receipt> {
        self.receipts.get(receipt_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    fn active_agent() -> AgentProfile {
        AgentProfile {
            account_hash: "account-hash-agent001".to_string(),
            public_key: "public-key-agent001".to_string(),
            name: "RWA Sentinel".to_string(),
            metadata_uri: "https://proxykey.app/agents/rwa-sentinel.json".to_string(),
            capabilities_hash: "hash-capabilities".to_string(),
            status: AgentStatus::Active,
        }
    }

    fn mandate() -> Mandate {
        Mandate {
            id: "mandate-001".to_string(),
            user: "account-hash-user001".to_string(),
            agent: "account-hash-agent001".to_string(),
            scope: MandateScope::Delegated,
            cap: 10_000,
            spent: 0,
            target: "rwa-risk-api".to_string(),
            resource_pattern_hash: "hash-rwa-resource".to_string(),
            expiry_block: 100,
            status: MandateStatus::Active,
        }
    }

    #[test]
    fn stages_intent_only_for_active_agent_and_rejects_replay() {
        let mut registry = AgentRegistry::default();
        registry.register_agent(active_agent());
        let mut inbox = IntentInbox::default();
        let intent = Intent {
            id: "intent-001".to_string(),
            user: "account-hash-user001".to_string(),
            agent: "account-hash-agent001".to_string(),
            target: "rwa-risk-api".to_string(),
            action: "fetch-risk-report".to_string(),
            amount: 2_500,
            resource_hash: "hash-rwa-resource".to_string(),
            payload_hash: "hash-payload".to_string(),
            nonce: "nonce-001".to_string(),
            status: IntentStatus::Pending,
        };

        assert_eq!(inbox.stage_intent(&registry, intent.clone()), Ok(()));
        assert_eq!(
            inbox.stage_intent(&registry, intent),
            Err(ProxyKeyError::NonceAlreadyUsed)
        );
    }

    #[test]
    fn enforces_delegated_mandate_cap_target_resource_and_balance() {
        let user = "account-hash-user001".to_string();
        let agent = "account-hash-agent001".to_string();
        let mut vault = MandateVault::default();
        vault.deposit(user.clone(), 10_000);
        vault.create_mandate(&user, mandate()).unwrap();

        assert_eq!(
            vault.execute_payment(
                &agent,
                "mandate-001",
                2_500,
                "rwa-risk-api",
                "hash-rwa-resource",
                50,
            ),
            Ok(())
        );
        assert_eq!(vault.balance_of(&user), 7_500);
        assert_eq!(
            vault.execute_payment(
                &agent,
                "mandate-001",
                8_000,
                "rwa-risk-api",
                "hash-rwa-resource",
                50,
            ),
            Err(ProxyKeyError::CapExceeded)
        );
    }

    #[test]
    fn revokes_mandate_and_blocks_execution() {
        let user = "account-hash-user001".to_string();
        let agent = "account-hash-agent001".to_string();
        let mut vault = MandateVault::default();
        vault.deposit(user.clone(), 10_000);
        vault.create_mandate(&user, mandate()).unwrap();
        vault.revoke_mandate(&user, "mandate-001").unwrap();

        assert_eq!(
            vault.execute_payment(
                &agent,
                "mandate-001",
                2_500,
                "rwa-risk-api",
                "hash-rwa-resource",
                50,
            ),
            Err(ProxyKeyError::MandateInactive)
        );
    }
}
