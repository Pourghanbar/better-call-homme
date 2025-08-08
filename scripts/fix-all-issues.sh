#!/bin/bash

echo "🔧 Comprehensive Fix for Better Call Homme Deployment..."

# 1. Build correct architecture image
echo "📦 Building AMD64 image..."
docker buildx build --platform linux/amd64 -f Dockerfile.simple -t better-call-homme-amd64 . --load

# 2. Push to ECR
echo "🚀 Pushing to ECR..."
docker tag better-call-homme-amd64:latest 683494507058.dkr.ecr.us-east-1.amazonaws.com/better-call-homme:latest
docker push 683494507058.dkr.ecr.us-east-1.amazonaws.com/better-call-homme:latest

# 3. Create a completely new task definition with minimal configuration
echo "📋 Creating new task definition..."

cat > task-definition-fixed.json << 'EOF'
{
  "family": "better-call-homme-fixed",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::683494507058:role/production-better-call-homme-execution-role",
  "taskRoleArn": "arn:aws:iam::683494507058:role/production-better-call-homme-task-role",
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
          "awslogs-group": "/ecs/better-call-homme-fixed",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# 4. Create log group
aws logs create-log-group --log-group-name "/ecs/better-call-homme-fixed" --region us-east-1 2>/dev/null || echo "Log group already exists"

# 5. Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition-fixed.json --region us-east-1

# 6. Get infrastructure details
VPC_ID=$(aws ec2 describe-vpcs --region us-east-1 --filters 'Name=tag:Name,Values=*better-call-homme*' --query 'Vpcs[0].VpcId' --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --region us-east-1 --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')
SECURITY_GROUP=$(aws ec2 describe-security-groups --region us-east-1 --filters "Name=vpc-id,Values=$VPC_ID" "Name=description,Values=*ECS*" --query 'SecurityGroups[0].GroupId' --output text)
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[?contains(TargetGroupName, `better-call-homme`)].TargetGroupArn' --output text)

echo "🏗️ Infrastructure details:"
echo "VPC: $VPC_ID"
echo "Subnets: $SUBNET_IDS"
echo "Security Group: $SECURITY_GROUP"
echo "Target Group: $TARGET_GROUP_ARN"

# 7. Delete old service if it exists
echo "🗑️ Cleaning up old service..."
aws ecs delete-service --cluster production-better-call-homme-cluster --service simple-better-call-homme-service --force --region us-east-1 2>/dev/null || echo "Old service not found"

# 8. Create new service
echo "🚀 Creating new service..."
aws ecs create-service \
    --cluster production-better-call-homme-cluster \
    --service-name better-call-homme-fixed \
    --task-definition better-call-homme-fixed \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=app,containerPort=3000" \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ New service created successfully!"
    echo ""
    echo "⏳ Waiting for deployment..."
    sleep 120
    
    echo "🔍 Checking service status..."
    RUNNING_TASKS=$(aws ecs describe-services --cluster production-better-call-homme-cluster --services better-call-homme-fixed --region us-east-1 --query 'services[0].runningCount' --output text 2>/dev/null)
    
    if [ "$RUNNING_TASKS" -gt 0 ]; then
        echo "🎉 SUCCESS! $RUNNING_TASKS tasks are running"
        echo ""
        echo "🌐 Your application is now LIVE at:"
        echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com"
        echo ""
        echo "📞 Twilio webhook URL:"
        echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com/voice/incoming"
    else
        echo "❌ Service is not running yet. Check AWS Console for details."
    fi
else
    echo "❌ Failed to create service"
fi 