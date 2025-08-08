#!/bin/bash

echo "🚀 Setting up ECS Service..."

# Get VPC ID
VPC_ID=$(aws ec2 describe-vpcs --region us-east-1 --filters 'Name=tag:Name,Values=*better-call-homme*' --query 'Vpcs[0].VpcId' --output text 2>/dev/null)

if [ -z "$VPC_ID" ]; then
    echo "❌ Could not find VPC. Please check AWS Console manually."
    exit 1
fi

echo "✅ Found VPC: $VPC_ID"

# Get Subnets
SUBNET_IDS=$(aws ec2 describe-subnets --region us-east-1 --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text | tr '\t' ' ')

if [ -z "$SUBNET_IDS" ]; then
    echo "❌ Could not find subnets. Please check AWS Console manually."
    exit 1
fi

echo "✅ Found Subnets: $SUBNET_IDS"

# Get Security Group
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups --region us-east-1 --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=*better-call-homme*" --query 'SecurityGroups[0].GroupId' --output text)

if [ -z "$SECURITY_GROUP_ID" ]; then
    echo "❌ Could not find security group. Please check AWS Console manually."
    exit 1
fi

echo "✅ Found Security Group: $SECURITY_GROUP_ID"

# Get Target Group ARN
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[?contains(TargetGroupName, `better-call-homme`)].TargetGroupArn' --output text)

if [ -z "$TARGET_GROUP_ARN" ]; then
    echo "❌ Could not find target group. Please check AWS Console manually."
    exit 1
fi

echo "✅ Found Target Group: $TARGET_GROUP_ARN"

# Create ECS Service
echo "📦 Creating ECS Service..."

aws ecs create-service \
    --cluster production-better-call-homme-cluster \
    --service-name better-call-homme-service \
    --task-definition production-better-call-homme-task \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$(echo $SUBNET_IDS | tr ' ' ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=app,containerPort=3000" \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ ECS Service created successfully!"
    echo ""
    echo "🌐 Your application is now running at:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com"
    echo ""
    echo "📞 Configure your Twilio webhook to:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com/voice/incoming"
    echo ""
    echo "📊 Retool API endpoint:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com/api"
else
    echo "❌ Failed to create ECS service. Please check the error above."
fi 