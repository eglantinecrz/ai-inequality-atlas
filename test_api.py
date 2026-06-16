#!/usr/bin/env python
import asyncio
import json
import sys
sys.path.insert(0, '.')
import main

async def test():
    data = await main.get_data()
    print(f"Total countries: {len(data)}")
    print(f"Keys: {sorted(data.keys())}")
    print("\nChecking specific countries:")
    for key in ['32', '36', '152', '156', '250', '826', '840']:
        if key in data:
            print(f"  {key}: {data[key]['name']}")
        else:
            print(f"  {key}: NOT FOUND")

asyncio.run(test())
