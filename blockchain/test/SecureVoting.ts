import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.connect();

describe("SecureVoting Contract", function () {

  async function deployFixture() {
    const [admin, voter] = await ethers.getSigners();

    const Voting = await ethers.getContractFactory("SecureVoting");
    const contract = await Voting.deploy(admin.address);
    await contract.waitForDeployment();

    const domain = {
      name: "SecureVoting",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress()
    };

    const voucherTypes = {
      Voucher: [
        { name: "voter", type: "address" },
        { name: "sessionId", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" }
      ]
    };

    const voteTypes = {
      Vote: [
        { name: "candidateId", type: "uint256" },
        { name: "sessionId", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" }
      ]
    };

    return { contract, admin, voter, domain, voucherTypes, voteTypes };
  }

  it("Should allow valid vote", async function () {

    const { contract, admin, voter, domain, voucherTypes, voteTypes } = await deployFixture();

    const nonce = 1;
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const sessionId = ethers.keccak256(ethers.toUtf8Bytes("session-1"));

    const voucher = {
      voter: voter.address,
      sessionId,
      nonce,
      expiry
    };

    const vote = {
      candidateId: 1,
      sessionId,
      nonce,
      expiry
    };

    const adminSig = await admin.signTypedData(domain, voucherTypes, voucher);
    const voterSig = await voter.signTypedData(domain, voteTypes, vote);

    await contract.vote(vote, voucher, voterSig, adminSig);

    expect(await contract.getVotes(1)).to.equal(1);
  });

  it("Should prevent double vote for same session", async function () {

    const { contract, admin, voter, domain, voucherTypes, voteTypes } = await deployFixture();

    const nonce = 1;
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const sessionId = ethers.keccak256(ethers.toUtf8Bytes("session-1"));

    const voucher = { voter: voter.address, sessionId, nonce, expiry };
    const vote = { candidateId: 1, sessionId, nonce, expiry };

    const adminSig = await admin.signTypedData(domain, voucherTypes, voucher);
    const voterSig = await voter.signTypedData(domain, voteTypes, vote);

    await contract.vote(vote, voucher, voterSig, adminSig);

    await expect(
      contract.vote(vote, voucher, voterSig, adminSig)
    ).to.be.revertedWith("Nonce already used");
  });

  it("Should allow same wallet to vote with different sessionId", async function () {

    const { contract, admin, voter, domain, voucherTypes, voteTypes } = await deployFixture();

    const expiry = Math.floor(Date.now() / 1000) + 1000;

    const session1 = ethers.keccak256(ethers.toUtf8Bytes("session-1"));
    const session2 = ethers.keccak256(ethers.toUtf8Bytes("session-2"));

    const voucher1 = { voter: voter.address, sessionId: session1, nonce: 1, expiry };
    const vote1 = { candidateId: 1, sessionId: session1, nonce: 1, expiry };

    const voucher2 = { voter: voter.address, sessionId: session2, nonce: 2, expiry };
    const vote2 = { candidateId: 2, sessionId: session2, nonce: 2, expiry };

    const adminSig1 = await admin.signTypedData(domain, voucherTypes, voucher1);
    const voterSig1 = await voter.signTypedData(domain, voteTypes, vote1);

    const adminSig2 = await admin.signTypedData(domain, voucherTypes, voucher2);
    const voterSig2 = await voter.signTypedData(domain, voteTypes, vote2);

    await contract.vote(vote1, voucher1, voterSig1, adminSig1);
    await contract.vote(vote2, voucher2, voterSig2, adminSig2);

    expect(await contract.getVotes(1)).to.equal(1);
    expect(await contract.getVotes(2)).to.equal(1);
  });

});