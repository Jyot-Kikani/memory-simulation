document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const TOTAL_MEMORY_SIZE = 1024; // Total KB for dynamic memory
    // STATIC_PARTITIONS REMOVED
    const SIMULATION_TICK_MS = 1000; // Update interval in milliseconds

    // --- DOM Elements ---
    const allocationAlgorithmSelect = document.getElementById('allocation-algorithm');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const defragmentButton = document.getElementById('defragment-button'); // Added
    const statusDisplay = document.getElementById('status');

    const processNameInput = document.getElementById('process-name');
    const processPriorityInput = document.getElementById('process-priority');
    const processBurstInput = document.getElementById('process-burst');
    const processSizeInput = document.getElementById('process-size');
    const addProcessButton = document.getElementById('add-process-button');
    const errorMessageDiv = document.getElementById('error-message');

    const processQueueList = document.getElementById('process-queue-list');
    // staticMemoryGrid REMOVED
    const dynamicMemoryGrid = document.getElementById('dynamic-memory');
    const exitedProcessList = document.getElementById('exited-process-list');
    // staticTotalSizeSpan REMOVED
    const dynamicTotalSizeSpan = document.getElementById('dynamic-total-size');

    // --- State Variables ---
    let processQueue = []; // { id, name, priority, burstTime, size, timeLeft, state: 'waiting'/'running', allocatedBlockId: null }
    let allProcesses = []; // Master list of all processes added
    // staticMemory REMOVED
    let dynamicMemory = []; // { id, startAddress, size, isFree: true, processId: null }
    let nextProcessId = 1;
    let nextBlockId = 1; // For dynamic blocks
    let simulationInterval = null;
    let simulationRunning = false;

    // --- Initialization ---
    function initialize() {
        console.log("Initializing Simulation...");
        processQueue = [];
        allProcesses = [];
        exitedProcesses = []; // Clear exited list too
        nextProcessId = 1;
        nextBlockId = 1;

        // Initialize Dynamic Memory (start with one large free block)
        dynamicMemory = [{
            id: `b${nextBlockId++}`,
            startAddress: 0,
            size: TOTAL_MEMORY_SIZE,
            isFree: true,
            processId: null
        }];
        dynamicTotalSizeSpan.textContent = TOTAL_MEMORY_SIZE;

        renderMemory(); // Removed 'static'/'dynamic' type argument
        renderQueue();
        renderExitedList();
        updateControlButtonStates();
        console.log("Initialization Complete.");
    }

    // --- Rendering Functions ---
    function renderQueue() {
        processQueueList.innerHTML = ''; // Clear current list
        const sortedQueue = [...processQueue]
            .filter(p => p.state === 'waiting') // Only show waiting processes in queue list
            .sort((a, b) => b.priority - a.priority || a.id - b.id);

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

    // Updated: Only renders dynamic memory
    function renderMemory() {
        const grid = dynamicMemoryGrid;
        const memory = dynamicMemory;
        const totalSize = TOTAL_MEMORY_SIZE;

        grid.innerHTML = ''; // Clear current grid
         // Sort by address FOR RENDERING ORDER
         memory.sort((a, b) => a.startAddress - b.startAddress);

        memory.forEach(block => {
            const blockDiv = document.createElement('div');
            blockDiv.classList.add('memory-block');
            blockDiv.style.height = `${Math.max(1, (block.size / totalSize) * 100)}%`;
            blockDiv.dataset.blockId = block.id;

            if (block.isFree) {
                blockDiv.classList.add('free');
                 // blockDiv.textContent = `Free: ${block.size}KB`; // Optional: display size
            } else {
                blockDiv.classList.add('allocated');
                const process = findProcessByIdGlobal(block.processId); // Use global finder
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
                     blockDiv.textContent = `Error: P${block.processId} not found!`;
                     blockDiv.style.backgroundColor = 'red';
                }
            }
            grid.appendChild(blockDiv);
        });

        // Add filler if needed (less likely with dynamic but good practice)
         if (memory.length === 0 || memory.every(b => b.isFree && memory.length === 1)) {
            const filler = document.createElement('div');
            filler.style.flexGrow = '1';
            grid.appendChild(filler);
         }
    }

     let exitedProcesses = [];
     function renderExitedList() {
        exitedProcessList.innerHTML = '';
        if (exitedProcesses.length === 0) {
            exitedProcessList.innerHTML = '<li>No processes finished yet</li>';
            return;
        }
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

        errorMessageDiv.textContent = '';
        if (!name || isNaN(priority) || priority < 1 || isNaN(burstTime) || burstTime < 1 || isNaN(size) || size < 1) {
            errorMessageDiv.textContent = 'Invalid input. Please check values.';
             return;
        }
         if (size > TOTAL_MEMORY_SIZE) {
             errorMessageDiv.textContent = `Process size (${size}KB) exceeds total memory (${TOTAL_MEMORY_SIZE}KB).`;
             return;
         }
         // Static partition check removed

        const newProcess = {
            id: nextProcessId++,
            name: name,
            priority: priority,
            burstTime: burstTime,
            size: size,
            timeLeft: burstTime,
            state: 'waiting',
            allocatedBlockId: null, // Will hold the ID of the dynamic block
            // memoryType removed
            // allocatedStaticBlockId / allocatedDynamicBlockId removed (use allocatedBlockId)
        };

        allProcesses.push(newProcess); // Add to master list
        processQueue.push(newProcess); // Add to waiting queue
        console.log(`Process Added: ${JSON.stringify(newProcess)}`);
        renderQueue();

        processNameInput.value = '';
        processPriorityInput.value = '1';
        processBurstInput.value = '10';
        processSizeInput.value = '50';

        attemptAllocation(); // Try to allocate immediately
    }

    // --- Memory Allocation Algorithms --- (No changes needed here, they operate on a memory array)

    function findFirstFit(process, memory) {
        for (let i = 0; i < memory.length; i++) {
            if (memory[i].isFree && memory[i].size >= process.size) {
                return i;
            }
        }
        return -1;
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

    // --- Allocation & Deallocation ---

    // Simplified attemptAllocation for dynamic memory only
    function attemptAllocation() {
        console.log("Attempting Allocation...");
        const algorithm = allocationAlgorithmSelect.value;
        let allocationMade = false;

        let sortedQueue = processQueue
                            .filter(p => p.state === 'waiting')
                            .sort((a, b) => b.priority - a.priority || a.id - b.id);

        let processesToUpdateState = []; // Processes that get allocated in this pass

        // Ensure dynamic memory is sorted by address before allocation attempts
        dynamicMemory.sort((a, b) => a.startAddress - b.startAddress);

        for (let process of sortedQueue) {
            if (process.state !== 'waiting') continue;

            let dynamicBlockIndex = -1;

            if (algorithm === 'first') dynamicBlockIndex = findFirstFit(process, dynamicMemory);
            else if (algorithm === 'best') dynamicBlockIndex = findBestFit(process, dynamicMemory);
            else if (algorithm === 'worst') dynamicBlockIndex = findWorstFit(process, dynamicMemory);

            if (dynamicBlockIndex !== -1) {
                const blockToAllocate = dynamicMemory[dynamicBlockIndex];
                const originalSize = blockToAllocate.size;
                const remainingSize = originalSize - process.size;

                console.log(`Allocating P${process.id} (${process.size}KB) to Dynamic Block ${blockToAllocate.id} (${originalSize}KB)`);

                // Update the allocated block
                blockToAllocate.isFree = false;
                blockToAllocate.processId = process.id;
                blockToAllocate.size = process.size; // Adjust block size to fit process exactly

                // Update process state
                process.allocatedBlockId = blockToAllocate.id; // Store the block ID
                processesToUpdateState.push(process.id); // Mark for state change
                allocationMade = true;

                 // Handle fragmentation: Create new hole if space remains
                 if (remainingSize > 0) {
                     const newHole = {
                         id: `b${nextBlockId++}`,
                         startAddress: blockToAllocate.startAddress + process.size,
                         size: remainingSize,
                         isFree: true,
                         processId: null
                     };
                     // Insert the new hole immediately after the allocated block
                     dynamicMemory.splice(dynamicBlockIndex + 1, 0, newHole);
                     console.log(`Dynamic Fragmentation: Created new hole ${newHole.id} (${newHole.size}KB)`);
                 }
                 // Allocation successful for this process, move to next in priority queue
            } else {
                 // console.log(`P${process.id} could not fit in dynamic memory currently.`);
                 // Keep process in queue for next attempt
            }
        } // End loop through sorted waiting queue

        // Update the state of successfully allocated processes and remove from visual queue
        if (processesToUpdateState.length > 0) {
            processQueue = processQueue.map(p => {
                if (processesToUpdateState.includes(p.id)) {
                    return { ...p, state: 'running' };
                }
                return p;
            }).filter(p => p.state !== 'running'); // Filter out allocated ones from queue visibility

             // Keep running processes in the master 'allProcesses' list
             allProcesses = allProcesses.map(p => {
                 if (processesToUpdateState.includes(p.id)) {
                     const allocatedProcess = findProcessByIdGlobal(p.id); // Get the updated one
                     return { ...p, state: 'running', allocatedBlockId: allocatedProcess.allocatedBlockId };
                 }
                 return p;
             });
        }


        // Re-render if changes occurred
        if (allocationMade) {
            renderMemory();
            renderQueue(); // Update queue display
        }
    }


     // Simplified deallocateProcess for dynamic memory only
     function deallocateProcess(processId) {
        const process = findProcessByIdGlobal(processId);
        if (!process || !process.allocatedBlockId) {
            console.error(`Cannot deallocate: Process P${processId} not found or not allocated.`);
            return;
        }

        const blockId = process.allocatedBlockId;
        const blockIndex = dynamicMemory.findIndex(b => b.id === blockId);

        if (blockIndex === -1) {
            console.error(`Cannot deallocate: Block ${blockId} for P${processId} not found in dynamic memory.`);
             // Maybe the process finished but block was already merged somehow? Clean up state.
             process.state = 'finished';
             if (!exitedProcesses.some(ep => ep.id === process.id)) {
                 exitedProcesses.push({...process});
                 renderExitedList();
             }
             // Remove from allProcesses? Or just keep as finished. Keep for now.
            return;
        }

        const block = dynamicMemory[blockIndex];
        console.log(`Deallocating P${processId} from Dynamic Block ${block.id}`);

         // Animate exit
         const blockDiv = dynamicMemoryGrid.querySelector(`[data-block-id="${block.id}"]`);
         if (blockDiv) {
             blockDiv.classList.add('exiting');
         }

        // Reset block state
        block.isFree = true;
        block.processId = null;
        // Size was already adjusted on allocation, it's now a hole of that process's size

         // Add to exited list (ensure it's done only once)
         process.state = 'finished';
         if (!exitedProcesses.some(ep => ep.id === process.id)) {
            exitedProcesses.push({...process}); // Store a copy
            renderExitedList();
         }

        // Merge free blocks
        mergeFreeBlocks(dynamicMemory, blockIndex);

         // Render changes after a short delay for animation
         setTimeout(() => {
             renderMemory();
             // Crucial: After deallocation, try to allocate waiting processes
             attemptAllocation();
         }, 500); // Match animation duration if any
    }

     function mergeFreeBlocks(memory, freedBlockIndex) {
        // Ensure memory is sorted by start address before merging for correctness
        memory.sort((a, b) => a.startAddress - b.startAddress);
        // Find the actual current index after sorting
        const currentBlock = memory[freedBlockIndex]; // Block that just became free
        const currentIndex = memory.findIndex(b => b.id === currentBlock.id);

        if (currentIndex === -1) {
            console.error("Error finding freed block after sorting for merge.");
            return; // Should not happen
        }

        let blockToMerge = memory[currentIndex]; // Start with the block itself


        // Merge with NEXT block if it's free
        if (currentIndex + 1 < memory.length) {
            let nextBlock = memory[currentIndex + 1];
            if (nextBlock.isFree) {
                console.log(`Merging freed block ${blockToMerge.id} with next block ${nextBlock.id}`);
                blockToMerge.size += nextBlock.size;
                memory.splice(currentIndex + 1, 1); // Remove the next block
                 // The current block (blockToMerge) remains at currentIndex
            }
        }

        // Merge with PREVIOUS block if it's free
        if (currentIndex > 0) {
             let prevBlock = memory[currentIndex - 1];
             if (prevBlock.isFree) {
                console.log(`Merging freed block ${blockToMerge.id} with previous block ${prevBlock.id}`);
                prevBlock.size += blockToMerge.size;
                // Start address of prevBlock remains the same
                memory.splice(currentIndex, 1); // Remove the current block (blockToMerge)
             }
        }
        // No need to re-sort here as merges maintain order relative to neighbors
    }

    // --- Defragmentation ---
    function defragmentMemory() {
        if (simulationRunning) {
            alert("Please stop the simulation before defragmenting.");
            return;
        }
        console.log("Defragmenting Memory...");

        // Separate allocated and free blocks
        const allocatedBlocks = dynamicMemory.filter(b => !b.isFree);
        const totalFreeSize = dynamicMemory
                                .filter(b => b.isFree)
                                .reduce((sum, b) => sum + b.size, 0);

        if (totalFreeSize === 0 && dynamicMemory.length === allocatedBlocks.length) {
            console.log("Memory is fully allocated. No defragmentation needed.");
            return; // Nothing to defragment
        }
         if (dynamicMemory.length - allocatedBlocks.length <= 1 && dynamicMemory.every(b => !b.isFree || (b.isFree && b.startAddress + b.size === TOTAL_MEMORY_SIZE))) {
             console.log("Memory is already defragmented or has only one hole at the end.");
            return; // Already effectively defragmented
         }


        let newDynamicMemory = [];
        let currentAddress = 0;

        // Add allocated blocks consecutively at the top
        allocatedBlocks.sort((a, b) => a.startAddress - b.startAddress); // Maintain relative order if desired
        allocatedBlocks.forEach(block => {
            block.startAddress = currentAddress; // Update start address
            newDynamicMemory.push(block);
            currentAddress += block.size;
        });

        // Add one large free block at the end if there's space
        if (totalFreeSize > 0) {
            newDynamicMemory.push({
                id: `b${nextBlockId++}`, // New ID for the combined hole
                startAddress: currentAddress,
                size: totalFreeSize,
                isFree: true,
                processId: null
            });
        }

        dynamicMemory = newDynamicMemory; // Replace old memory layout
        console.log("Defragmentation complete.");
        renderMemory(); // Update the display
        updateControlButtonStates(); // Update button states (defrag might become disabled if fully compacted)
    }


    // --- Simulation Loop ---
    function simulationStep() {
        // console.log("Simulation Tick...");
        let processFinished = false;

        // Find running processes by checking allocated blocks in dynamic memory
        let runningProcessIds = new Set();
         dynamicMemory.forEach(b => {
             if (!b.isFree && b.processId) {
                 runningProcessIds.add(b.processId);
             }
         });

         // Decrement time for running processes
         runningProcessIds.forEach(pid => {
             const process = findProcessByIdGlobal(pid);
             if (process && process.state === 'running') {
                 process.timeLeft--;

                 if (process.timeLeft <= 0) {
                     console.log(`Process P${pid} (${process.name}) finished.`);
                     processFinished = true;
                     // Call the simplified deallocate function
                     deallocateProcess(pid); // This handles state update, render, and re-allocation attempt
                 }
             }
         });


        // Re-render memory to show updated timers ONLY if no process finished
        // because deallocateProcess handles rendering after finishes.
        if (!processFinished) {
             renderMemory();
        }
        // Note: attemptAllocation is called inside deallocateProcess if a process finishes
    }

    function startSimulation() {
        if (simulationRunning) return;
        simulationRunning = true;
        simulationInterval = setInterval(simulationStep, SIMULATION_TICK_MS);
        updateControlButtonStates();
        statusDisplay.textContent = "Status: Running";
        statusDisplay.className = 'status-running';
        console.log("Simulation Started.");
        attemptAllocation(); // Try allocating anything waiting in queue
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

     // Finds process from the master list
     function findProcessByIdGlobal(processId) {
         return allProcesses.find(p => p.id === processId);
     }


    function updateControlButtonStates() {
        const isFragmented = dynamicMemory.filter(b => b.isFree).length > 1;

        startButton.disabled = simulationRunning;
        stopButton.disabled = !simulationRunning;
        allocationAlgorithmSelect.disabled = simulationRunning;
        // Enable defrag only when stopped and memory is actually fragmented
        defragmentButton.disabled = simulationRunning || !isFragmented;
    }


    // --- Event Listeners ---
    addProcessButton.addEventListener('click', handleAddProcess);
    startButton.addEventListener('click', startSimulation);
    stopButton.addEventListener('click', stopSimulation);
    defragmentButton.addEventListener('click', defragmentMemory); // Added listener

    // --- Initial Call ---
    initialize();
});