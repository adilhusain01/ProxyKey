#![no_std]
#![no_main]

extern crate alloc;

use casper_contract::contract_api::{account, runtime, system};
use casper_contract::unwrap_or_revert::UnwrapOrRevert;
use casper_types::contracts::ContractPackageHash;
use casper_types::{runtime_args, Key, RuntimeArgs, U512};

const CARGO_PURSE_ARG: &str = "cargo_purse";

#[no_mangle]
pub extern "C" fn call() {
    let package_hash_bytes: [u8; 32] = runtime::get_named_arg("package_hash");
    let user: Key = runtime::get_named_arg("user");
    let amount: U512 = runtime::get_named_arg("amount");

    let cargo_purse = system::create_purse();
    system::transfer_from_purse_to_purse(account::get_main_purse(), cargo_purse, amount, None)
        .unwrap_or_revert();

    let args: RuntimeArgs = runtime_args! {
        "user" => user,
        CARGO_PURSE_ARG => cargo_purse,
    };

    runtime::call_versioned_contract::<()>(
        ContractPackageHash::new(package_hash_bytes),
        None,
        "deposit",
        args,
    );
}
