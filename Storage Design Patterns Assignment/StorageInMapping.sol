pragma solidity 0.8.4;
pragma abicoder v2;

contract StorageInMapping {
    
   struct Entity{
      uint data;
      address _address;
    }
    
    mapping(address => Entity) internal _entities;
    
    
    function addEntity(uint entityData) public {
        require(_entities[msg.sender]._address == address(0), "Entry already exists!");
        _entities[msg.sender] = Entity(entityData, msg.sender);
    }
    

    function updateEntity(uint entityData) public {
        require(_entities[msg.sender]._address == msg.sender, "No current entry to update!");
        _entities[msg.sender].data = entityData;
    }
    
    
    function getEntity() public view returns(Entity memory theRecord) {
        return _entities[msg.sender];
    }
    
}
