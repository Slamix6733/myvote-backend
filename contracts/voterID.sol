// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VoterID {
    struct Voter {
        string name;
        uint256 dob;
        string voterIdHash;
        bool isVerified;
        string aadharNumber;
        string residentialAddress;
        uint256 registrationTimestamp;
        uint256 lastVerifiedTimestamp;
    }

    mapping(address => Voter) public voters;
    mapping(string => bool) private usedAadharNumbers;
    mapping(string => bool) private usedVoterIds;
    
    address public admin;
    uint256 public voterCount;
    bool public registrationOpen;

    event VoterRegistered(address indexed voter, string name, uint256 timestamp);
    event VoterVerified(address indexed voter, uint256 timestamp);
    event RegistrationStatusChanged(bool isOpen);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
        registrationOpen = true;
        voterCount = 0;
    }

    function registerVoter(
        string memory _name, 
        uint256 _dob, 
        string memory _voterIdHash,
        string memory _aadharNumber,
        string memory _residentialAddress
    ) public {
        require(registrationOpen, "Voter registration is currently closed");
        require(bytes(voters[msg.sender].voterIdHash).length == 0, "Already registered");
        require(!usedAadharNumbers[_aadharNumber], "Aadhar number already registered");
        require(!usedVoterIds[_voterIdHash], "Voter ID already registered");
        
        usedAadharNumbers[_aadharNumber] = true;
        usedVoterIds[_voterIdHash] = true;
        
        voters[msg.sender] = Voter(
            _name, 
            _dob, 
            _voterIdHash, 
            false, 
            _aadharNumber, 
            _residentialAddress,
            block.timestamp,
            0
        );
        
        voterCount++;
        emit VoterRegistered(msg.sender, _name, block.timestamp);
    }

    function verifyVoter(address _voter) public onlyAdmin {
        require(bytes(voters[_voter].voterIdHash).length > 0, "Voter not registered");
        require(!voters[_voter].isVerified, "Voter already verified");
        
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
        string memory name,
        uint256 dob,
        bool isVerified,
        string memory residentialAddress,
        uint256 registrationTimestamp,
        uint256 lastVerifiedTimestamp
    ) {
        Voter memory voter = voters[_voter];
        return (
            voter.name,
            voter.dob,
            voter.isVerified,
            voter.residentialAddress,
            voter.registrationTimestamp,
            voter.lastVerifiedTimestamp
        );
    }
    
    function transferAdmin(address _newAdmin) public onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        admin = _newAdmin;
    }
}
