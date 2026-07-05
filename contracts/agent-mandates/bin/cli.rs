use odra::host::{HostEnv, NoArgs};
use odra_cli::{
    deploy::DeployScript, DeployedContractsContainer, DeployerExt, OdraCli,
};
use proxykey_agent_mandates::agent_mandates::AgentMandates;

pub struct AgentMandatesDeploy;

impl DeployScript for AgentMandatesDeploy {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer,
    ) -> Result<(), odra_cli::deploy::Error> {
        let _contract = AgentMandates::load_or_deploy(
            env,
            NoArgs,
            container,
            500_000_000_000,
        )?;
        Ok(())
    }
}

pub fn main() {
    OdraCli::new()
        .about("ProxyKey AgentMandates deployment and interaction CLI")
        .deploy(AgentMandatesDeploy)
        .contract::<AgentMandates>()
        .build()
        .run();
}
