const DataUtils = require("../libs/dataUtils");
const { getUserName } = require("../libs/utils");
const SyncOptimizer = require("../utils/syncOptimizer");

class SyncManager {
  static async syncAllGroups(api, db, logger) {
    try {
      // Check if sync is disabled in config
      const config = require("../config.json");
      if (config.skipSync === true) {
        logger.info("⚠️ Sync disabled in config, skipping...");
        return { syncedGroups: 0, syncedUsers: 0, skipped: true };
      }
      
      // Check if database is connected
      if (!db || !global.GoatBot.db) {
        logger.warn("⚠️ Database not connected, skipping sync");
        return { syncedGroups: 0, syncedUsers: 0 };
      }
      
      logger.info("🔄 Starting fast group sync...");
      
      const groupList = await api.groupFetchAllParticipating();
      const groups = Object.entries(groupList).map(([id, data]) => ({ id, ...data }));
      
      // Use optimized sync with proper parameters
      const optimizer = new SyncOptimizer();
      
      // Create sync function for individual groups
      const syncGroupFunction = async (group) => {
        try {
          // Fast sync - just update basic info
          const groupData = {
            id: group.id,
            name: group.subject || "Unknown Group",
            participantCount: group.participants?.length || 0,
            lastUpdated: Date.now()
          };
          
          // Update in database
          await db.updateGroup(group.id, groupData);
          
          return { syncedGroups: 1, syncedUsers: groupData.participantCount };
        } catch (error) {
          logger.warn(`Failed to sync group ${group.id}: ${error.message}`);
          return { syncedGroups: 0, syncedUsers: 0 };
        }
      };
      
      // Run optimized sync
      const syncResult = await optimizer.optimizeGroupSync(groups, syncGroupFunction, logger);
      
      if (syncResult.syncedGroups > 0) {
        logger.info(`✅ Fast sync complete: ${syncResult.syncedGroups} groups, ${syncResult.syncedUsers} users`);
        return syncResult;
      } else {
        logger.error("❌ Optimized sync failed:", syncResult.error);
        // Fallback to traditional sync
        return await this.traditionalGroupSync(api, db, logger, groupList);
      }
      
    } catch (error) {
      logger.error("Error during group sync:", error);
      return { syncedGroups: 0, syncedUsers: 0 };
    }
  }
  
  static async traditionalGroupSync(api, db, logger, groupList) {
    logger.info("🔄 Falling back to traditional sync...");
    
    let syncedGroups = 0;
    let syncedUsers = 0;
    
    // Process groups in smaller batches to prevent overwhelming
    const groupEntries = Object.entries(groupList);
    const batchSize = 10;
    
    for (let i = 0; i < groupEntries.length; i += batchSize) {
      const batch = groupEntries.slice(i, i + batchSize);
      
      for (const [groupId, groupData] of batch) {
        try {
          const threadData = await DataUtils.getThread(groupId);
          
          const updatedThreadData = {
            ...threadData,
            id: groupId,
            isGroup: true,
            name: groupData.subject || threadData.name || 'Unknown Group',
            description: groupData.desc || threadData.description || '',
            participants: [],
            admins: [],
            lastActivity: Date.now()
          };
          
          // Process participants in smaller batches
          const participantBatches = [];
          for (let j = 0; j < groupData.participants.length; j += 5) {
            participantBatches.push(groupData.participants.slice(j, j + 5));
          }
          
          for (const participantBatch of participantBatches) {
            for (const participant of participantBatch) {
              updatedThreadData.participants.push(participant.id);
              
              if (participant.admin) {
                updatedThreadData.admins.push(participant.id);
              }
              
              try {
                let userName = null;
                
                // Try to get name from participant data
                if (participant.notify) {
                  userName = participant.notify;
                } else if (participant.name) {
                  userName = participant.name;
                } else {
                  // Try to get from contact info with timeout
                  try {
                    const contactPromise = api.onWhatsApp(participant.id);
                    const timeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Timeout')), 3000)
                    );
                    
                    const contactInfo = await Promise.race([contactPromise, timeoutPromise]);
                    if (contactInfo && contactInfo.length > 0 && contactInfo[0].notify) {
                      userName = contactInfo[0].notify;
                    }
                  } catch (contactError) {
                    // Silently ignore contact errors during sync
                  }
                }
                
                // Only update if we have a real name
                const updateData = {
                  lastSeen: Date.now(),
                  isGroup: true
                };
                
                if (userName && userName !== 'Unknown') {
                  updateData.name = userName;
                }
                
                await DataUtils.updateUser(participant.id, updateData);
                syncedUsers++;
                
              } catch (error) {
                logger.error(`Error syncing user ${participant.id}:`, error);
              }
            }
            
            // Small delay between participant batches
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          await DataUtils.updateThread(groupId, updatedThreadData);
          syncedGroups++;
          
        } catch (error) {
          logger.error(`Error syncing group ${groupId}:`, error);
        }
      }
      
      // Progress update
      logger.info(`📊 Sync progress: ${syncedGroups}/${groupEntries.length} groups processed`);
      
      // Small delay between group batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    logger.info(`✅ Traditional sync complete: ${syncedGroups} groups, ${syncedUsers} users`);
    return { syncedGroups, syncedUsers };
  }
  
  static async syncGroupParticipants(api, groupId, logger) {
    try {
      const groupMetadata = await api.groupMetadata(groupId);
      const threadData = await DataUtils.getThread(groupId);
      
      const updatedThreadData = {
        ...threadData,
        id: groupId,
        isGroup: true,
        name: groupMetadata.subject || threadData.name || 'Unknown Group',
        description: groupMetadata.desc || threadData.description || '',
        participants: [],
        admins: [],
        lastActivity: Date.now()
      };
      
      for (const participant of groupMetadata.participants) {
        updatedThreadData.participants.push(participant.id);
        
        if (participant.admin) {
          updatedThreadData.admins.push(participant.id);
        }
        
        const userName = await getUserName(participant.id, null, api);
        
        await DataUtils.updateUser(participant.id, {
          name: userName,
          lastSeen: Date.now(),
          isGroup: true
        });
      }
      
      await DataUtils.updateThread(groupId, updatedThreadData);
      
      logger.info(`✅ Synced group ${groupId}: ${updatedThreadData.participants.length} participants`);
      return updatedThreadData;
      
    } catch (error) {
      logger.error(`Error syncing group ${groupId}:`, error);
      return null;
    }
  }
}

module.exports = SyncManager;
