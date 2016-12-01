#!/bin/bash
while true; do 
 cd /home/pi/gitrepos/garden/webhmi/
 /usr/local/bin/node gartenServerScheduler.js 
 sleep 60
done
