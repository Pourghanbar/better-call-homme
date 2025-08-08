#!/bin/bash

echo "🔍 Getting deployment information..."

# Get Load Balancer DNS
ALB_DNS=$(aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName, `better-call-homme`)].DNSName' --output text 2>/dev/null)

if [ -z "$ALB_DNS" ]; then
    echo "❌ Could not find load balancer. Please check AWS Console manually."
    echo "Look for a load balancer with 'better-call-homme' in the name."
else
    echo "✅ Load Balancer DNS: $ALB_DNS"
    echo ""
    echo "🌐 Your application will be available at:"
    echo "   http://$ALB_DNS"
    echo ""
    echo "📞 Configure your Twilio webhook to:"
    echo "   http://$ALB_DNS/voice/incoming"
    echo ""
    echo "📊 Retool API endpoint:"
    echo "   http://$ALB_DNS/api"
fi

echo ""
echo "📋 Next steps:"
echo "1. Configure Twilio webhook with the URL above"
echo "2. Set up Retool dashboard to connect to the API"
echo "3. Test the voice system by calling your Twilio number"
echo ""
echo "🔧 To manually deploy the ECS service, run:"
echo "   aws ecs register-task-definition --cli-input-json file://task-definition.json"
echo "   aws ecs create-service --cluster production-better-call-homme-cluster --service-name better-call-homme-service --task-definition better-call-homme-task --desired-count 1" 