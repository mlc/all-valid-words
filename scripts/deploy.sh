#!/bin/sh
aws s3 cp --content-type 'text/html;charset=utf-8' --content-language 'en-US' --cache-control 'public,max-age=86400' index.html s3://words.oulipo.link/index.html
