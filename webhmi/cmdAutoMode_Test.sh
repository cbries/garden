#!/bin/bash

# Sleep Values for Minutes
# 1 minute    := 60
# 5 minutes   := 300
# 10 minutes  := 600
# 15 minutes  := 900
# 20 minutes  := 1200
# 25 minutes  := 1500
# 30 minutes  := 1800
##########################

# vordere Teil im Garten, Nebenbeet und Teil vom Rasen
node gartenServerCaller.js -n trees -s true -t 1
sleep 65
node gartenServerCaller.js -n trees -s false
sleep 10

# hintere Teil des Garten an der Hütte
node gartenServerCaller.js -n backyard -s true -t 1
sleep 65
node gartenServerCaller.js -n backyard -s false
sleep 10

# 6 Sprueher vorne im Garten
node gartenServerCaller.js -n main -s true -t 1
sleep 65
node gartenServerCaller.js -n main -s false
sleep 10

# Sprühnebel und Tröpfchenleitung
node gartenServerCaller.js -n dropping -s true -t 1
sleep 65
node gartenServerCaller.js -n dropping -s false
sleep 10

