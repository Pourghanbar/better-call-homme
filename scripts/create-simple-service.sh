#!/bin/bash

echo "🚀 Creating a simple working service..."

# Create a simple task definition
cat > simple-task.json << 'EOF'
{
  "family": "simple-better-call-homme",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::683494507058:role/production-better-call-homme-execution-role",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "683494507058.dkr.ecr.us-east-1.amazonaws.com/better-call-homme:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/simple-better-call-homme",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Create log group
aws logs create-log-group --log-group-name "/ecs/simple-better-call-homme" --region us-east-1 2>/dev/null || echo "Log group already exists"

# Register task definition
aws ecs register-task-definition --cli-input-json file://simple-task.json --region us-east-1

# Get subnet IDs
SUBNET_IDS=$(aws ec2 describe-subnets --region us-east-1 --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --region us-east-1 --filters 'Name=tag:Name,Values=*better-call-homme*' --query 'Vpcs[0].VpcId' --output text)" --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')

# Get security group from the same VPC
VPC_ID=$(aws ec2 describe-vpcs --region us-east-1 --filters 'Name=tag:Name,Values=*better-call-homme*' --query 'Vpcs[0].VpcId' --output text)
SECURITY_GROUP=$(aws ec2 describe-security-groups --region us-east-1 --filters "Name=vpc-id,Values=$VPC_ID" "Name=description,Values=*ECS*" --query 'SecurityGroups[0].GroupId' --output text)

# Get target group
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[?contains(TargetGroupName, `better-call-homme`)].TargetGroupArn' --output text)

echo "📦 Creating simple service..."

aws ecs create-service \
    --cluster production-better-call-homme-cluster \
    --service-name simple-better-call-homme-service \
    --task-definition simple-better-call-homme \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=app,containerPort=3000" \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ Simple service created successfully!"
    echo ""
    echo "🌐 Your application will be available at:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com"
    echo ""
    echo "📞 Twilio webhook URL:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com/voice/incoming"
else
    echo "❌ Failed to create service"
fi 