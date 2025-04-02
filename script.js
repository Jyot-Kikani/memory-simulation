document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const TOTAL_MEMORY_SIZE = 1024; // Total KB for dynamic memory
    const STATIC_PARTITIONS = [ // Define fixed static partitions {id, size}
        { id: 's1', size: 100 },
        { id: 's2', size: 250 },
        { id: 's3', size: 150 },
        { id: 's4', size: 300 },
        { id: 's5', size: 224 } // Ensure total matches display if needed
    ];
    const SIMULATION_TICK_MS = 1000; // Update interval in milliseconds

    // --- DOM Elements ---
    const allocationAlgorithmSelect = document.getElementById('allocation-algorithm');
    // const timeQuantumInput = document.getElementById('time-quantum'); // Removed
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const statusDisplay = document.getElementById('status');

    const processNameInput = document.getElementById('process-name');
    const processPriorityInput = document.getElementById('process-priority');
    const processBurstInput = document.getElementById('process-burst');
    const processSizeInput = document.getElementById('process-size');
    const addProcessButton = document.getElementById('add-process-button');
    const errorMessageDiv = document.getElementById('error-message');

    const processQueueList = document.getElementById('process-queue-list');
    const staticMemoryGrid = document.getElementById('static-memory');
    const dynamicMemoryGrid = document.getElementById('dynamic-memory');
    const exitedProcessList = document.getElementById('exited-process-list');
    const staticTotalSizeSpan = document.getElementById('static-total-size');
    const dynamicTotalSizeSpan = document.getElementById('dynamic-total-size');

    // --- State Variables ---
    let processQueue = []; // { id, name, priority, burstTime, size, timeLeft, state: 'waiting'/'running', allocatedBlockId: null, memoryType: null }
    let staticMemory = []; // { id, size, isFree: true, processId: null }
    let dynamicMemory = []; // { id, startAddress, size, isFree: true, processId: null }
    let nextProcessId = 1;
    let nextBlockId = 1; // For dynamic blocks
    let simulationInterval = null;
    let simulationRunning = false;

    // --- Initialization ---
    function initialize() {
        console.log("Initializing Simulation...");
        // Initialize Static Memory
        let staticTotal = 0;
        staticMemory = STATIC_PARTITIONS.map(p => {
             staticTotal += p.size;
             return {...p, isFree: true, processId: null };
        });
        staticTotalSizeSpan.textContent = staticTotal;

        // Initialize Dynamic Memory (start with one large free block)
        dynamicMemory = [{
            id: `b${nextBlockId++}`,
            startAddress: 0,
            size: TOTAL_MEMORY_SIZE,
            isFree: true,
            processId: null
        }];
        dynamicTotalSizeSpan.textContent = TOTAL_MEMORY_SIZE;

        renderMemory('static');
        renderMemory('dynamic');
        renderQueue();
        renderExitedList(); // Clear exited list on init
        updateControlButtonStates();
        console.log("Initialization Complete.");
    }

    // --- Rendering Functions ---
    function renderQueue() {
        processQueueList.innerHTML = ''; // Clear current list
        // Sort queue by priority (descending) then by ID (ascending for stability)
        const sortedQueue = [...processQueue].sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return a.id - b.id; // FIFO for same priority
        });

        if (sortedQueue.length === 0) {
             processQueueList.innerHTML = '<li>Queue is empty</li>';
             return;
        }

        sortedQueue.forEach(proc => {
            const li = document.createElement('li');
            li.textContent = `ID: ${proc.id}, Name: ${proc.name}, Prio: ${proc.priority}, Size: ${proc.size}KB, Burst: ${proc.burstTime}`;
            processQueueList.appendChild(li);
        });
    }

    function renderMemory(type) {
        const grid = (type === 'static') ? staticMemoryGrid : dynamicMemoryGrid;
        const memory = (type === 'static') ? staticMemory : dynamicMemory;
        const totalSize = (type === 'static') ? STATIC_PARTITIONS.reduce((sum, p) => sum + p.size, 0) : TOTAL_MEMORY_SIZE;

        grid.innerHTML = ''; // Clear current grid

        memory.forEach(block => {
            const blockDiv = document.createElement('div');
            blockDiv.classList.add('memory-block');
            blockDiv.style.height = `${Math.max(1, (block.size / totalSize) * 100)}%`; // Use percentage height, ensure minimum visibility
            blockDiv.dataset.blockId = block.id; // Store block ID for reference

            if (block.isFree) {
                blockDiv.classList.add('free');
                if (type === 'static') blockDiv.classList.add('static-partition');
                // Optionally display size for free blocks
                // blockDiv.textContent = `Free: ${block.size}KB`;
            } else {
                blockDiv.classList.add('allocated');
                if (type === 'static') blockDiv.classList.add('static-partition');

                const process = findProcessById(block.processId);
                if (process) {
                    const infoDiv = document.createElement('div');
                    infoDiv.classList.add('process-info');
                    infoDiv.textContent = `${process.name} (${process.size}KB)`;

                    const timerDiv = document.createElement('div');
                    timerDiv.classList.add('process-timer');
                    timerDiv.textContent = `Time Left: ${process.timeLeft}`;

                    blockDiv.appendChild(infoDiv);
                    blockDiv.appendChild(timerDiv);
                } else {
                     // Should not happen in normal operation
                     blockDiv.textContent = `Error: Process P${block.processId} not found!`;
                     blockDiv.style.backgroundColor = 'red';
                }
            }
            grid.appendChild(blockDiv);
        });
         // Add a small element to push flex items visually if grid is empty or nearly empty
         if (memory.length === 0 || memory.every(b => b.isFree)) {
            const filler = document.createElement('div');
            filler.style.flexGrow = '1'; // Take up remaining space
            grid.appendChild(filler);
         }
    }

     // Keep track of exited processes for display
     let exitedProcesses = [];
     function renderExitedList() {
        exitedProcessList.innerHTML = '';
        if (exitedProcesses.length === 0) {
            exitedProcessList.innerHTML = '<li>No processes finished yet</li>';
            return;
        }
         // Display latest exited first
        exitedProcesses.slice().reverse().forEach(proc => {
             const li = document.createElement('li');
             li.textContent = `ID: ${proc.id}, Name: ${proc.name}, Size: ${proc.size}KB (Finished)`;
             exitedProcessList.appendChild(li);
        });
     }


    // --- Process Management ---
    function handleAddProcess() {
        const name = processNameInput.value.trim();
        const priority = parseInt(processPriorityInput.value);
        const burstTime = parseInt(processBurstInput.value);
        const size = parseInt(processSizeInput.value);

        // Basic Validation
        errorMessageDiv.textContent = ''; // Clear previous errors
        if (!name) {
            errorMessageDiv.textContent = 'Process name cannot be empty.';
            return;
        }
        if (isNaN(priority) || priority < 1) {
            errorMessageDiv.textContent = 'Priority must be a number >= 1.';
            return;
        }
        if (isNaN(burstTime) || burstTime < 1) {
            errorMessageDiv.textContent = 'Burst time must be a number >= 1.';
            return;
        }
        if (isNaN(size) || size < 1) {
            errorMessageDiv.textContent = 'Size must be a number >= 1.';
            return;
        }
         if (size > TOTAL_MEMORY_SIZE) {
             errorMessageDiv.textContent = `Process size (${size}KB) exceeds total dynamic memory (${TOTAL_MEMORY_SIZE}KB).`;
             return;
         }
         // Check if size exceeds largest static partition (optional but good)
         const maxStaticSize = Math.max(...STATIC_PARTITIONS.map(p => p.size));
          if (size > maxStaticSize) {
             console.warn(`Process P${nextProcessId} (${size}KB) is too large for any static partition (Max: ${maxStaticSize}KB). It can only run in dynamic memory.`);
             // Allow adding, but it might never run in static.
         }


        const newProcess = {
            id: nextProcessId++,
            name: name,
            priority: priority,
            burstTime: burstTime,
            size: size,
            timeLeft: burstTime,
            state: 'waiting', // waiting, running, finished
            allocatedBlockId: null,
            memoryType: null // 'static' or 'dynamic'
        };

        processQueue.push(newProcess);
        console.log(`Process Added: ${JSON.stringify(newProcess)}`);
        renderQueue();

        // Clear form
        processNameInput.value = '';
        processPriorityInput.value = '1';
        processBurstInput.value = '10';
        processSizeInput.value = '50';

        // Try to allocate immediately if simulation is running or stopped (queue might have space)
         attemptAllocation();

    }

    // --- Memory Allocation Algorithms ---

    function findFirstFit(process, memory) {
        for (let i = 0; i < memory.length; i++) {
            if (memory[i].isFree && memory[i].size >= process.size) {
                return i; // Return index of the first suitable block
            }
        }
        return -1; // Not found
    }

    function findBestFit(process, memory) {
        let bestFitIndex = -1;
        let minSuitableSize = Infinity;

        for (let i = 0; i < memory.length; i++) {
            if (memory[i].isFree && memory[i].size >= process.size) {
                if (memory[i].size < minSuitableSize) {
                    minSuitableSize = memory[i].size;
                    bestFitIndex = i;
                }
            }
        }
        return bestFitIndex;
    }

    function findWorstFit(process, memory) {
        let worstFitIndex = -1;
        let maxSuitableSize = -1;

        for (let i = 0; i < memory.length; i++) {
            if (memory[i].isFree && memory[i].size >= process.size) {
                if (memory[i].size > maxSuitableSize) {
                    maxSuitableSize = memory[i].size;
                    worstFitIndex = i;
                }
            }
        }
        return worstFitIndex;
    }

    function allocateProcess(process, blockIndex, memoryType) {
        const memory = (memoryType === 'static') ? staticMemory : dynamicMemory;
        const block = memory[blockIndex];

        console.log(`Allocating P${process.id} (${process.size}KB) to ${memoryType} Block ${block.id} (${block.size}KB)`);

        const originalBlockSize = block.size;
        const remainingSize = block.size - process.size;

        // Update the allocated block
        block.isFree = false;
        block.processId = process.id;
        block.size = process.size; // For dynamic, adjust size to fit process exactly

        // Update process state
        process.state = 'running';
        process.allocatedBlockId = block.id;
        process.memoryType = memoryType;

        // Handle fragmentation in Dynamic Memory Only
        if (memoryType === 'dynamic' && remainingSize > 0) {
            const newHole = {
                id: `b${nextBlockId++}`,
                startAddress: block.startAddress + process.size,
                size: remainingSize,
                isFree: true,
                processId: null
            };
            // Insert the new hole immediately after the allocated block
            memory.splice(blockIndex + 1, 0, newHole);
            console.log(`Dynamic Fragmentation: Created new hole ${newHole.id} (${newHole.size}KB)`);
        } else if (memoryType === 'static' && remainingSize > 0) {
             // Static partitions keep their original size, just mark as used
             block.size = originalBlockSize; // Restore original size visually/logically
             console.log(`Static Partition ${block.id}: Internal fragmentation of ${remainingSize}KB`);
        }


        // Remove process from queue visually (will be filtered out in next queue render)
        // Might need a more robust way if allocation fails later for the other memory type
        // Let's update the queue fully after attempting both allocations.

        return true; // Allocation successful for this memory type
    }

     function deallocateProcess(processId) {
        const process = findProcessByIdGlobal(processId); // Find in running state
        if (!process || !process.allocatedBlockId || !process.memoryType) {
            console.error(`Cannot deallocate: Process P${processId} not found or not allocated.`);
            return;
        }

        const memoryType = process.memoryType;
        const memory = (memoryType === 'static') ? staticMemory : dynamicMemory;
        const blockId = process.allocatedBlockId;
        const blockIndex = memory.findIndex(b => b.id === blockId);

        if (blockIndex === -1) {
            console.error(`Cannot deallocate: Block ${blockId} for P${processId} not found in ${memoryType} memory.`);
            return;
        }

        const block = memory[blockIndex];
        console.log(`Deallocating P${processId} from ${memoryType} Block ${block.id}`);

         // Animate exit visually before removing
         const grid = (memoryType === 'static') ? staticMemoryGrid : dynamicMemoryGrid;
         const blockDiv = grid.querySelector(`[data-block-id="${block.id}"]`);
         if (blockDiv) {
             blockDiv.classList.add('exiting');
         }


        // Reset block state
        block.isFree = true;
        block.processId = null;
        // For static memory, size remains fixed. For dynamic, size is already correct.

         // Add to exited list
         process.state = 'finished';
         exitedProcesses.push({...process}); // Store a copy
         renderExitedList();

         // Remove from active processes (conceptually, actual removal from queue happened on allocation)


        // Merge free blocks in Dynamic Memory ONLY
        if (memoryType === 'dynamic') {
            mergeFreeBlocks(memory, blockIndex);
        }

         // Render changes after a short delay for animation
         setTimeout(() => {
             renderMemory(memoryType);
             // Crucial: After deallocation, try to allocate waiting processes
             attemptAllocation();
         }, 500); // Match animation duration if any

    }

     function mergeFreeBlocks(memory, freedBlockIndex) {
        let currentBlock = memory[freedBlockIndex];

        // Merge with NEXT block if it's free
        if (freedBlockIndex + 1 < memory.length) {
            let nextBlock = memory[freedBlockIndex + 1];
            if (nextBlock.isFree) {
                console.log(`Merging freed block ${currentBlock.id} with next block ${nextBlock.id}`);
                currentBlock.size += nextBlock.size;
                memory.splice(freedBlockIndex + 1, 1); // Remove the next block
                 // No need to change startAddress
            }
        }

        // Merge with PREVIOUS block if it's free
        // Note: freedBlockIndex might be invalid if merged with next, so re-find or adjust index
        // It's safer to check the block *before* the potentially modified currentBlock's position
         let potentiallyNewIndex = memory.findIndex(b => b.id === currentBlock.id); // Find it again
        if (potentiallyNewIndex > 0) {
             let prevBlock = memory[potentiallyNewIndex - 1];
             if (prevBlock.isFree) {
                console.log(`Merging freed block ${currentBlock.id} with previous block ${prevBlock.id}`);
                prevBlock.size += currentBlock.size;
                // Start address of prevBlock remains the same
                memory.splice(potentiallyNewIndex, 1); // Remove the current block
             }
        }
        // No need to re-sort dynamic memory here as merges maintain order
    }


    function attemptAllocation() {
        console.log("Attempting Allocation...");
        const algorithm = allocationAlgorithmSelect.value;
        let allocationMade = false;

         // Get a mutable copy of the queue sorted by priority
        let sortedQueue = processQueue
                            .filter(p => p.state === 'waiting')
                            .sort((a, b) => b.priority - a.priority || a.id - b.id);

        let processesToRemoveFromQueue = [];

        for (let process of sortedQueue) {
            if (process.state !== 'waiting') continue; // Skip already allocated or finished

            let allocatedStatic = false;
            let allocatedDynamic = false;

            // --- Try Static Allocation ---
            let staticBlockIndex = -1;
             const staticMemCopy = staticMemory; // Reference is fine here
            if (algorithm === 'first') staticBlockIndex = findFirstFit(process, staticMemCopy);
            else if (algorithm === 'best') staticBlockIndex = findBestFit(process, staticMemCopy);
            else if (algorithm === 'worst') staticBlockIndex = findWorstFit(process, staticMemCopy);

            if (staticBlockIndex !== -1) {
                // Simulate allocation: mark block, update process (but maybe don't modify global state yet?)
                 // For simulation, we apply to both if possible.
                 // We need to *clone* the process if allocating to both, which complicates things.
                 // Let's simplify: A process from the queue is allocated to ONE place (dynamic preferred if fits both?)
                 // OR, the user wants to see the *effect* on both grids. Let's stick to the latter.
                 // This means a process might appear in *both* grids if it fits.

                 // We need separate tracking for allocation status per memory type
                 process.allocatedStaticBlockId = null; // Reset flags
                 process.allocatedDynamicBlockId = null;

                 // Allocate to Static
                 let staticMemBlock = staticMemory[staticBlockIndex];
                 staticMemBlock.isFree = false;
                 staticMemBlock.processId = process.id; // Link process to block
                 process.allocatedStaticBlockId = staticMemBlock.id; // Link block to process for static
                 allocationMade = true;
                 console.log(`P${process.id} allocated to static block ${staticMemBlock.id}`);

            } else {
                 console.log(`P${process.id} could not fit in static memory.`);
            }


            // --- Try Dynamic Allocation ---
            let dynamicBlockIndex = -1;
             // Sort dynamic memory by address before finding fit - important for consistency and merging logic
             dynamicMemory.sort((a, b) => a.startAddress - b.startAddress);
             const dynamicMemCopy = dynamicMemory; // Use the sorted version

            if (algorithm === 'first') dynamicBlockIndex = findFirstFit(process, dynamicMemCopy);
            else if (algorithm === 'best') dynamicBlockIndex = findBestFit(process, dynamicMemCopy);
            else if (algorithm === 'worst') dynamicBlockIndex = findWorstFit(process, dynamicMemCopy);

            if (dynamicBlockIndex !== -1) {
                 // Allocate dynamically (causes potential split)
                const blockToAllocate = dynamicMemory[dynamicBlockIndex];
                const originalSize = blockToAllocate.size;
                const remainingSize = originalSize - process.size;

                 blockToAllocate.isFree = false;
                 blockToAllocate.processId = process.id;
                 blockToAllocate.size = process.size; // Adjust size

                 process.allocatedDynamicBlockId = blockToAllocate.id; // Link block to process for dynamic
                 allocationMade = true;
                 console.log(`P${process.id} allocated to dynamic block ${blockToAllocate.id}`);

                 // Handle split
                 if (remainingSize > 0) {
                     const newHole = {
                         id: `b${nextBlockId++}`,
                         startAddress: blockToAllocate.startAddress + process.size,
                         size: remainingSize,
                         isFree: true,
                         processId: null
                     };
                     dynamicMemory.splice(dynamicBlockIndex + 1, 0, newHole);
                     console.log(`Dynamic split: Created hole ${newHole.id} (${newHole.size}KB)`);
                 }
             } else {
                  console.log(`P${process.id} could not fit in dynamic memory.`);
             }

             // --- Update Process State ---
             // If allocated to *either* static or dynamic, mark as running and remove from queue list
             if (process.allocatedStaticBlockId || process.allocatedDynamicBlockId) {
                 process.state = 'running';
                 processesToRemoveFromQueue.push(process.id);
             }

        } // End loop through sorted waiting queue


         // Remove allocated processes from the actual processQueue
         processQueue = processQueue.filter(p => !processesToRemoveFromQueue.includes(p.id));


        // Re-render everything if any allocation happened
        if (allocationMade) {
            renderMemory('static');
            renderMemory('dynamic');
            renderQueue(); // Update queue display
        }
    }

    // --- Simulation Loop ---
    function simulationStep() {
        console.log("Simulation Tick...");
        let processFinished = false;

        // Find all *running* processes (allocated in either memory)
         // Need a combined list conceptually, or iterate through memory blocks
         let runningProcessIds = new Set();
         staticMemory.forEach(b => { if (!b.isFree && b.processId) runningProcessIds.add(b.processId); });
         dynamicMemory.forEach(b => { if (!b.isFree && b.processId) runningProcessIds.add(b.processId); });


         // Decrement time for all running processes
         runningProcessIds.forEach(pid => {
             const process = findProcessByIdGlobal(pid); // Find the process object
             if (process && process.state === 'running') {
                 process.timeLeft--;
                 // console.log(`P${pid} time left: ${process.timeLeft}`);

                 if (process.timeLeft <= 0) {
                     console.log(`Process P${pid} finished.`);
                     processFinished = true;

                     // Store finished process info before deallocation might clear links
                      const finishedInfo = { ...process };

                     // Deallocate from BOTH static and dynamic if it was in both
                     if (process.allocatedStaticBlockId) {
                         deallocateProcessFromMemory(pid, 'static');
                     }
                     if (process.allocatedDynamicBlockId) {
                         deallocateProcessFromMemory(pid, 'dynamic');
                     }

                      // Add to exited list (only once)
                      if (!exitedProcesses.some(ep => ep.id === finishedInfo.id)) {
                         finishedInfo.state = 'finished';
                         exitedProcesses.push(finishedInfo);
                         renderExitedList();
                      }

                      // Mark original process object as finished (though it's effectively gone)
                      process.state = 'finished';
                 }
             }
         });


        // Re-render memory to show updated timers (only if no process finished, as deallocate handles render then)
        if (!processFinished) {
             renderMemory('static');
             renderMemory('dynamic');
        } else {
            // If a process finished, deallocation called render AND attemptAllocation
             console.log("Process finished, re-evaluating queue...");
             // attemptAllocation(); // Deallocation already calls this
        }
    }

     // Helper for deallocation within the simulation step to avoid async timing issues
     function deallocateProcessFromMemory(processId, memoryType) {
         const memory = (memoryType === 'static') ? staticMemory : dynamicMemory;
         const blockIndex = memory.findIndex(b => b.processId === processId); // Find block by process ID it holds

         if (blockIndex === -1) {
             // This might happen if called for both static/dynamic but process was only in one
             // console.warn(`Could not find P${processId} in ${memoryType} memory during deallocation.`);
             return;
         }

         const block = memory[blockIndex];
         console.log(`Deallocating P${processId} from ${memoryType} Block ${block.id} (Simulation Step)`);

         const grid = (memoryType === 'static') ? staticMemoryGrid : dynamicMemoryGrid;
         const blockDiv = grid.querySelector(`[data-block-id="${block.id}"]`);
         if (blockDiv) {
             blockDiv.classList.add('exiting'); // Visual cue
         }

         block.isFree = true;
         block.processId = null;

         if (memoryType === 'dynamic') {
             mergeFreeBlocks(memory, blockIndex);
         }

          // Schedule render and allocation attempt *after* the current tick logic completes
          // Use setTimeout 0 to push to end of event loop queue
          setTimeout(() => {
              renderMemory(memoryType);
              attemptAllocation(); // Try to fill the freed space
          }, 0);
     }


    function startSimulation() {
        if (simulationRunning) return;
        simulationRunning = true;
        // const quantum = parseInt(timeQuantumInput.value) || 1000; // Use selected quantum
        const quantum = SIMULATION_TICK_MS; // Fixed tick rate
        simulationInterval = setInterval(simulationStep, quantum);
        updateControlButtonStates();
        statusDisplay.textContent = "Status: Running";
        statusDisplay.className = 'status-running';
        console.log("Simulation Started.");
        // Attempt initial allocation if queue isn't empty
        attemptAllocation();
    }

    function stopSimulation() {
        if (!simulationRunning) return;
        simulationRunning = false;
        clearInterval(simulationInterval);
        simulationInterval = null;
        updateControlButtonStates();
         statusDisplay.textContent = "Status: Stopped";
        statusDisplay.className = 'status-stopped';
        console.log("Simulation Stopped.");
    }

    // --- Utility Functions ---
    function findProcessById(processId) {
         // Search only within the *active* queue or potentially running processes
         // This needs refinement if processes are removed from queue on allocation.
         // Let's assume processes stay in a master list or we search memory blocks.
        // For rendering timers, we need the original process object.

        // Search static memory
        let block = staticMemory.find(b => b.processId === processId);
        if (block) {
             // We need the actual process object, not just the block
             // Assume processQueue might still hold it, or we need another list
            return findProcessByIdGlobal(processId); // Use helper
        }

         // Search dynamic memory
         block = dynamicMemory.find(b => b.processId === processId);
         if (block) {
              return findProcessByIdGlobal(processId); // Use helper
         }

         return null; // Not found running in memory
    }

    // Helper to find process object from *anywhere* (queue, exited, implicitly running)
    // This requires maintaining a master list or searching multiple places.
    // Let's create a conceptual list of all processes ever added.
    let allProcesses = []; // Store all added processes here
    // Modify addProcess to push to allProcesses
    // Re-implement handleAddProcess slightly:
    const original_handleAddProcess = handleAddProcess; // Keep reference if needed
    function handleAddProcess() {
         // ... (validation code from original handleAddProcess) ...
        const name = processNameInput.value.trim();
        const priority = parseInt(processPriorityInput.value);
        const burstTime = parseInt(processBurstInput.value);
        const size = parseInt(processSizeInput.value);

        // Basic Validation (copied for completeness)
        errorMessageDiv.textContent = '';
        if (!name || isNaN(priority) || priority < 1 || isNaN(burstTime) || burstTime < 1 || isNaN(size) || size < 1) {
            errorMessageDiv.textContent = 'Invalid input. Please check values.';
             return;
        }
         if (size > TOTAL_MEMORY_SIZE) {
             errorMessageDiv.textContent = `Process size (${size}KB) exceeds total dynamic memory (${TOTAL_MEMORY_SIZE}KB).`;
             return;
         }
         const maxStaticSize = Math.max(...STATIC_PARTITIONS.map(p => p.size));
          if (size > maxStaticSize) {
             console.warn(`Process P${nextProcessId} (${size}KB) is too large for any static partition (Max: ${maxStaticSize}KB).`);
         }


        const newProcess = {
            id: nextProcessId++,
            name: name,
            priority: priority,
            burstTime: burstTime,
            size: size,
            timeLeft: burstTime,
            state: 'waiting',
            allocatedBlockId: null, // General - details below
            memoryType: null,
            // Add specific allocation tracking needed by revised attemptAllocation
            allocatedStaticBlockId: null,
            allocatedDynamicBlockId: null
        };

        allProcesses.push(newProcess); // Add to master list
        processQueue.push(newProcess); // Add to waiting queue
        console.log(`Process Added: ${JSON.stringify(newProcess)}`);
        renderQueue();

        // Clear form
        processNameInput.value = '';
        processPriorityInput.value = '1';
        processBurstInput.value = '10';
        processSizeInput.value = '50';

        attemptAllocation();
    }
    // Now findProcessByIdGlobal can search allProcesses
     function findProcessByIdGlobal(processId) {
         return allProcesses.find(p => p.id === processId);
     }


    function updateControlButtonStates() {
        startButton.disabled = simulationRunning;
        stopButton.disabled = !simulationRunning;
        // Disable algorithm/quantum changes while running?
        allocationAlgorithmSelect.disabled = simulationRunning;
        // timeQuantumInput.disabled = simulationRunning; // Removed
        // Optionally disable adding processes while running heavily? For now, allow.
        // addProcessButton.disabled = simulationRunning;
    }


    // --- Event Listeners ---
    addProcessButton.addEventListener('click', handleAddProcess); // Use the modified handler
    startButton.addEventListener('click', startSimulation);
    stopButton.addEventListener('click', stopSimulation);

    // --- Initial Call ---
    initialize();
});