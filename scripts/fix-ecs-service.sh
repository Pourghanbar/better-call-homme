#!/bin/bash

echo "🔧 Fixing ECS Service..."

# Get the security group for ECS tasks
ECS_SECURITY_GROUP=$(aws ec2 describe-security-groups --region us-east-1 --filters "Name=group-name,Values=*better-call-homme*" "Name=description,Values=*ECS*" --query 'SecurityGroups[0].GroupId' --output text)

if [ -z "$ECS_SECURITY_GROUP" ]; then
    echo "❌ Could not find ECS security group"
    exit 1
fi

echo "✅ Found ECS Security Group: $ECS_SECURITY_GROUP"

# Add outbound rule to allow internet access
echo "🌐 Adding outbound rule for internet access..."
aws ec2 authorize-security-group-egress \
    --group-id "$ECS_SECURITY_GROUP" \
    --protocol -1 \
    --port -1 \
    --cidr 0.0.0.0/0 \
    --region us-east-1 2>/dev/null || echo "Outbound rule already exists"

# Create a working task definition
echo "📦 Creating working task definition..."

cat > task-definition-working.json << 'EOF'
{
  "family": "production-better-call-homme-task",
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
          "awslogs-group": "/ecs/production-better-call-homme",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Register the task definition
aws ecs register-task-definition --cli-input-json file://task-definition-working.json --region us-east-1

# Update the service
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster production-better-call-homme-cluster \
    --service better-call-homme-service \
    --task-definition production-better-call-homme-task \
    --force-new-deployment \
    --region us-east-1

echo "✅ Service updated. Waiting for deployment..."
sleep 60

# Check status
echo "📊 Checking service status..."
RUNNING_TASKS=$(aws ecs describe-services --cluster production-better-call-homme-cluster --services better-call-homme-service --region us-east-1 --query 'services[0].runningCount' --output text 2>/dev/null)

if [ "$RUNNING_TASKS" -gt 0 ]; then
    echo "✅ SUCCESS! $RUNNING_TASKS tasks are now running"
    echo ""
    echo "🌐 Your application should now be available at:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com"
    echo ""
    echo "📞 Twilio webhook URL:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com/voice/incoming"
else
    echo "❌ Still no running tasks. Please check AWS Console for more details."
fi 