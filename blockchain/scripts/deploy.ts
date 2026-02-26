import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.connect();

  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);

  const Voting = await ethers.getContractFactory("SecureVoting");

  const contract = await Voting.deploy(deployer.address);

  await contract.waitForDeployment();

  console.log("Contract deployed at:", await contract.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});