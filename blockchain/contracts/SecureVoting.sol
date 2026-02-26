// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SecureVoting is EIP712, ReentrancyGuard {

    address public admin;

    // ---------- UPDATED ----------
    mapping(bytes32 => bool) public hasVotedSession;

    mapping(uint256 => bool) public usedNonce;
    mapping(uint256 => uint256) public candidateVotes;

    struct Vote {
        uint256 candidateId;
        bytes32 sessionId;
        uint256 nonce;
        uint256 expiry;
    }

    struct Voucher {
        address voter;
        bytes32 sessionId;
        uint256 nonce;
        uint256 expiry;
    }

    // ---------- EIP712 Type Hashes ----------

    bytes32 private constant VOUCHER_TYPEHASH =
        keccak256(
            "Voucher(address voter,bytes32 sessionId,uint256 nonce,uint256 expiry)"
        );

    bytes32 private constant VOTE_TYPEHASH =
        keccak256(
            "Vote(uint256 candidateId,bytes32 sessionId,uint256 nonce,uint256 expiry)"
        );

    event NewVote(address indexed voter, uint256 indexed candidateId, bytes32 sessionId);

    constructor(address _admin)
        EIP712("SecureVoting", "1")
    {
        admin = _admin;
    }

    function vote(
        Vote calldata voteData,
        Voucher calldata voucher,
        bytes calldata voterSignature,
        bytes calldata adminSignature
    ) external nonReentrant {

        require(block.timestamp <= voteData.expiry, "Vote expired");
        require(block.timestamp <= voucher.expiry, "Voucher expired");

        require(voteData.nonce == voucher.nonce, "Nonce mismatch");
        require(!usedNonce[voteData.nonce], "Nonce already used");

        require(voteData.sessionId == voucher.sessionId, "Session mismatch");

        // ---------- Verify Admin Signature ----------

        bytes32 voucherStructHash = keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                voucher.voter,
                voucher.sessionId,
                voucher.nonce,
                voucher.expiry
            )
        );

        bytes32 voucherHash = _hashTypedDataV4(voucherStructHash);

        address recoveredAdmin = ECDSA.recover(voucherHash, adminSignature);
        require(recoveredAdmin == admin, "Invalid admin signature");

        // ---------- Verify Voter Signature ----------

        bytes32 voteStructHash = keccak256(
            abi.encode(
                VOTE_TYPEHASH,
                voteData.candidateId,
                voteData.sessionId,
                voteData.nonce,
                voteData.expiry
            )
        );

        bytes32 voteHash = _hashTypedDataV4(voteStructHash);

        address recoveredVoter = ECDSA.recover(voteHash, voterSignature);
        require(recoveredVoter == voucher.voter, "Invalid voter signature");

        // ---------- UPDATED UNIQUE CHECK ----------
        require(!hasVotedSession[voteData.sessionId], "Already voted");

        // ---------- Record Vote ----------
        hasVotedSession[voteData.sessionId] = true;
        usedNonce[voteData.nonce] = true;
        candidateVotes[voteData.candidateId]++;

        emit NewVote(recoveredVoter, voteData.candidateId, voteData.sessionId);
    }

    function getVotes(uint256 candidateId) external view returns (uint256) {
        return candidateVotes[candidateId];
    }
}