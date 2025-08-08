#!/bin/bash

echo "🔍 Checking ECS Service Status..."

# Check if service exists
SERVICE_STATUS=$(aws ecs describe-services --cluster production-better-call-homme-cluster --services better-call-homme-service --region us-east-1 --query 'services[0].status' --output text 2>/dev/null)

if [ "$SERVICE_STATUS" = "None" ] || [ -z "$SERVICE_STATUS" ]; then
    echo "❌ Service not found. Let's check what services exist:"
    aws ecs list-services --cluster production-better-call-homme-cluster --region us-east-1
    exit 1
fi

echo "✅ Service Status: $SERVICE_STATUS"

# Check running tasks
RUNNING_TASKS=$(aws ecs describe-services --cluster production-better-call-homme-cluster --services better-call-homme-service --region us-east-1 --query 'services[0].runningCount' --output text 2>/dev/null)
DESIRED_TASKS=$(aws ecs describe-services --cluster production-better-call-homme-cluster --services better-call-homme-service --region us-east-1 --query 'services[0].desiredCount' --output text 2>/dev/null)

echo "📊 Tasks: $RUNNING_TASKS running / $DESIRED_TASKS desired"

# Check target group health
echo "🏥 Checking Target Group Health..."
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[?contains(TargetGroupName, `better-call-homme`)].TargetGroupArn' --output text 2>/dev/null)

if [ ! -z "$TARGET_GROUP_ARN" ]; then
    echo "✅ Target Group: $TARGET_GROUP_ARN"
    aws elbv2 describe-target-health --target-group-arn "$TARGET_GROUP_ARN" --region us-east-1
else
    echo "❌ Could not find target group"
fi

# Check recent task failures
echo "📋 Recent Task Failures:"
aws ecs list-tasks --cluster production-better-call-homme-cluster --service-name better-call-homme-service --region us-east-1 --desired-status STOPPED --query 'taskArns' --output text 2>/dev/null | while read -r task; do
    if [ ! -z "$task" ]; then
        echo "Task: $task"
        aws ecs describe-tasks --cluster production-better-call-homme-cluster --tasks "$task" --region us-east-1 --query 'tasks[0].{lastStatus:lastStatus,stoppedReason:stoppedReason,stoppedAt:stoppedAt}' 2>/dev/null
    fi
done

echo ""
echo "🔧 Troubleshooting Steps:"
echo "1. Check if the Docker image exists in ECR"
echo "2. Verify the task definition is correct"
echo "3. Check if the secrets exist in AWS Secrets Manager"
echo "4. Review CloudWatch logs for errors" 