/**
 * Sync Optimizer - Optimizes database synchronization operations
 * @author @anbuinfosec
 */

class SyncOptimizer {
  constructor() {
    this.batchSize = 20; // Increased batch size for faster processing
    this.delay = 50; // Reduced delay between batches
    this.maxRetries = 2; // Reduced retries
    this.cache = new Map();
  }

  /**
   * Optimize group synchronization with batching and timeout
   */
  async optimizeGroupSync(groups, syncFunction, logger) {
    try {
      const startTime = Date.now();
      const timeout = 30000; // 30 second timeout
      
      const results = {
        syncedGroups: 0,
        syncedUsers: 0,
        errors: []
      };

      // Process groups in batches with timeout
      const processWithTimeout = async () => {
        for (let i = 0; i < groups.length; i += this.batchSize) {
          const batch = groups.slice(i, i + this.batchSize);
          
          // Process batch with Promise.allSettled for error handling
          const batchResults = await Promise.allSettled(
            batch.map(group => this.syncGroupWithRetry(group, syncFunction, logger))
          );

          // Process results
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              results.syncedGroups += result.value.syncedGroups || 0;
              results.syncedUsers += result.value.syncedUsers || 0;
            } else {
              results.errors.push(result.reason);
              if (logger) {
                logger.warn(`Group sync failed: ${result.reason.message}`);
              }
            }
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            if (logger) {
              logger.warn("Sync timeout reached, stopping...");
            }
            break;
          }

          // Small delay between batches to prevent rate limiting
          if (i + this.batchSize < groups.length) {
            await this.sleep(this.delay);
          }
        }
      };

      // Race between processing and timeout
      await Promise.race([
        processWithTimeout(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Sync timeout")), timeout))
      ]);

      return results;
    } catch (error) {
      if (logger) {
        logger.error("Sync optimizer error:", error);
      }
      throw error;
    }
  }

  /**
   * Sync a single group with retry logic (fast version)
   */
  async syncGroupWithRetry(group, syncFunction, logger) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await syncFunction(group);
      } catch (error) {
        lastError = error;
        if (logger && attempt === this.maxRetries) {
          logger.warn(`Group sync failed after ${this.maxRetries} attempts for ${group.id}: ${error.message}`);
        }
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.delay * attempt); // Exponential backoff
        }
      }
    }
    
    // Return empty result instead of throwing to prevent total failure
    return { syncedGroups: 0, syncedUsers: 0 };
  }

  /**
   * Sleep utility
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set optimization parameters
   */
  setConfig(config) {
    if (config.batchSize) this.batchSize = config.batchSize;
    if (config.delay) this.delay = config.delay;
    if (config.maxRetries) this.maxRetries = config.maxRetries;
  }
}

module.exports = SyncOptimizer;
