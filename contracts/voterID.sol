// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VoterID {
    struct Voter {
        bytes32 nameHash;
        bytes32 aadharHash;
        bool isVerified;
        uint256 registrationTimestamp;
        uint256 lastVerifiedTimestamp;
    }

    // Custom errors for better debugging
    error RegistrationClosed();
    error AlreadyRegistered();
    error AadharAlreadyRegistered();
    error EmptyHash();
    error VoterNotRegistered();
    error VoterAlreadyVerified();
    error InvalidAddress();
    error NotAdmin();

    mapping(address => Voter) public voters;
    mapping(bytes32 => bool) private usedAadharHashes;
    
    address public admin;
    uint256 public voterCount;
    bool public registrationOpen;

    event VoterRegistered(address indexed voter, bytes32 nameHash, bytes32 aadharHash, uint256 timestamp);
    event VoterVerified(address indexed voter, uint256 timestamp);
    event RegistrationStatusChanged(bool isOpen);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
        registrationOpen = true;
        voterCount = 0;
    }

    // Function to check if bytes32 is empty/zero
    function isEmptyBytes32(bytes32 value) internal pure returns (bool) {
        return value == bytes32(0);
    }

    // Regular registration function (voter self-registers)
    function registerVoter(
        bytes32 _nameHash,
        bytes32 _aadharHash
    ) public {
        if (!registrationOpen) revert RegistrationClosed();
        if (voters[msg.sender].registrationTimestamp != 0) revert AlreadyRegistered();
        if (usedAadharHashes[_aadharHash]) revert AadharAlreadyRegistered();
        if (isEmptyBytes32(_nameHash)) revert EmptyHash();
        if (isEmptyBytes32(_aadharHash)) revert EmptyHash();
        
        usedAadharHashes[_aadharHash] = true;
        
        voters[msg.sender] = Voter(
            _nameHash,
            _aadharHash,
            false,
            block.timestamp,
            0
        );
        
        voterCount++;
        emit VoterRegistered(msg.sender, _nameHash, _aadharHash, block.timestamp);
    }

    // Admin function to register a voter for a specific address
    function registerVoterByAdmin(
        address _voterAddress,
        bytes32 _nameHash,
        bytes32 _aadharHash
    ) public onlyAdmin {
        if (!registrationOpen) revert RegistrationClosed();
        if (voters[_voterAddress].registrationTimestamp != 0) revert AlreadyRegistered();
        if (usedAadharHashes[_aadharHash]) revert AadharAlreadyRegistered();
        if (isEmptyBytes32(_nameHash)) revert EmptyHash();
        if (isEmptyBytes32(_aadharHash)) revert EmptyHash();
        if (_voterAddress == address(0)) revert InvalidAddress();
        
        usedAadharHashes[_aadharHash] = true;
        
        voters[_voterAddress] = Voter(
            _nameHash,
            _aadharHash,
            false,
            block.timestamp,
            0
        );
        
        voterCount++;
        emit VoterRegistered(_voterAddress, _nameHash, _aadharHash, block.timestamp);
    }

    function verifyVoter(address _voter) public onlyAdmin {
        if (voters[_voter].registrationTimestamp == 0) revert VoterNotRegistered();
        if (voters[_voter].isVerified) revert VoterAlreadyVerified();
        
        voters[_voter].isVerified = true;
        voters[_voter].lastVerifiedTimestamp = block.timestamp;
        
        emit VoterVerified(_voter, block.timestamp);
    }

    function setRegistrationStatus(bool _isOpen) public onlyAdmin {
        registrationOpen = _isOpen;
        emit RegistrationStatusChanged(_isOpen);
    }

    function checkVoterStatus(address _voter) public view returns (bool) {
        return voters[_voter].isVerified;
    }
    
    function getVoterDetails(address _voter) public view returns (
        bytes32 nameHash,
        bytes32 aadharHash,
        bool isVerified,
        uint256 registrationTimestamp,
        uint256 lastVerifiedTimestamp
    ) {
        Voter memory voter = voters[_voter];
        return (
            voter.nameHash,
            voter.aadharHash,
            voter.isVerified,
            voter.registrationTimestamp,
            voter.lastVerifiedTimestamp
        );
    }
    
    function transferAdmin(address _newAdmin) public onlyAdmin {
        if (_newAdmin == address(0)) revert InvalidAddress();
        admin = _newAdmin;
    }
}
