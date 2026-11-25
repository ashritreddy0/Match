# Multiplayer Game Server Matchmaking System (CSE201)

**Live Demo:** https://ashritreddy0.github.io/Match/  
**Repository:** https://github.com/ashritreddy0/Match

## Overview
A Data Structures mini-project that pairs incoming online players with optimal game servers based on **region**, **available slot capacity**, and **minimum server load**.

## Data Structures & Time Complexity
* **FIFO Waiting Queue (`O(1)` Enqueue / `O(1)` Dequeue):** Maintains strict first-come, first-served player arrival order with zero starvation.
* **Binary Min-Heap (`O(log n)` Extract-Min / `O(log n)` Re-Heapify):** Orders active servers dynamically by current load percentage so the lowest-load eligible server is selected without scanning the entire fleet.

## Allocation Rules
1. **Region Match:** Server region must match the incoming player's region.
2. **Capacity Check:** Server must have available slots $\ge$ player party size.
3. **Minimum Load Selection:** Among eligible servers, assign the server with the lowest current load percentage and re-heapify.

## How to Run
1. Open the live visualizer at [https://ashritreddy0.github.io/Match/](https://ashritreddy0.github.io/Match/) (or open `index.html` in any web browser).
2. Click **Load PPT Demo** to populate the sample queue (`Player_A`, `Player_B`, `Player_C`) or enqueue custom players.
3. Click **Match Next Player** to step through each allocation and inspect the Min-Heap and system output logs.

## Project Team 
* **Ashrit Reddy** — NB25ISE273
* **Vineet Dadhwal** — NB25ISE269
* **Hari Narayanan** — NB25ISE264
* **Vinayak Raj** — NB25ISE268
