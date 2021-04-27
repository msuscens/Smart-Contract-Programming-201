pragma solidity 0.8.4;
pragma abicoder v2;

contract StorageInArray {
    
    struct Entity{
      uint data;
      address _address;
    }
    
    Entity[] internal _entities;
    
    
    function addEntity(uint entityData) public {
        require(!_hasAnEntity(msg.sender), "An entry already exists!");
        _entities.push(Entity(entityData, msg.sender));
    }
    

    function updateEntity(uint entityData) public {
        require(_hasAnEntity(msg.sender), "No current entry to update!");
        uint index = _getEntryIndex(msg.sender);
        _entities[index].data = entityData;
    }
    
    
    function getEntity(address target) public view returns(Entity memory theRecord) {
        return _entities[_getEntryIndex(target)];
    }
    
    
    // Internal functions
    
    function _hasAnEntity(address candidate) internal view returns(bool) {
        for (uint i=0; i<_entities.length; i++) {
            if (_entities[i]._address == candidate) return true;
        }
        return false;
    }
    
    
    function _getEntryIndex(address target) internal view returns(uint) {
        for (uint i=0; i<_entities.length; i++) {
            if (_entities[i]._address == target) return i;
        }
        revert ("No entry for this address");
    }
    
}
