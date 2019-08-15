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

#
#for i in `seq 1 1000`;
#do
#	echo "Testausgabe $i"
#	sleep 1
#done 
#
#exit 0

# vordere Teil im Garten, Nebenbeet und Teil vom Rasen
node gartenServerCaller.js -n trees -s true -t 1
sleep 10
node gartenServerCaller.js -n trees -s false -t 0
sleep 5

# hintere Teil des Garten an der Hütte
node gartenServerCaller.js -n backyard -s true -t 1
sleep 10
node gartenServerCaller.js -n backyard -s false -t 0
sleep 5

# 6 Sprueher vorne im Garten
node gartenServerCaller.js -n main -s true -t 1
sleep 10
node gartenServerCaller.js -n main -s false -t 0
sleep 5

# Sprühnebel und Tröpfchenleitung
node gartenServerCaller.js -n dropping -s true -t 1
sleep 10
node gartenServerCaller.js -n dropping -s false -t 0
sleep 5

##
## HAUPTABSCHALTUNG
##

node gartenServerCaller.js -n mainAutoMode -s false -t 0

