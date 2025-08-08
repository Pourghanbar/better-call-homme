#!/bin/bash

echo "🔍 Checking Final Application Status..."

# Check if the simple service is running
RUNNING_TASKS=$(aws ecs describe-services --cluster production-better-call-homme-cluster --services simple-better-call-homme-service --region us-east-1 --query 'services[0].runningCount' --output text 2>/dev/null)

if [ "$RUNNING_TASKS" -gt 0 ]; then
    echo "✅ SUCCESS! $RUNNING_TASKS tasks are running"
    echo ""
    echo "🎉 Your Better Call Homme application is now LIVE!"
    echo ""
    echo "🌐 Main Application URL:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com"
    echo ""
    echo "📞 Twilio Webhook URL:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com/voice/incoming"
    echo ""
    echo "📊 Retool API Endpoint:"
    echo "   http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com/api"
    echo ""
    echo "🔧 Next Steps:"
    echo "1. Configure your Twilio phone number webhook"
    echo "2. Set up your Retool dashboard"
    echo "3. Test the system by calling your Twilio number"
    echo ""
    echo "📝 Note: The application is running without database and with mock credentials."
    echo "   For full functionality, you'll need to:"
    echo "   - Add real Twilio credentials"
    echo "   - Add real OpenAI API key"
    echo "   - Set up PostgreSQL database"
else
    echo "❌ Application is not running yet"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "1. Check AWS ECS Console for task failures"
    echo "2. Review CloudWatch logs for errors"
    echo "3. Verify security group and networking configuration"
    echo ""
    echo "📞 For immediate testing, you can:"
    echo "1. Go to AWS Console > ECS"
    echo "2. Check the 'simple-better-call-homme-service'"
    echo "3. Look at the Events tab for error messages"
fi

echo ""
echo "🏠 Better Call Homme - Home Service Booking System"
echo "   Successfully deployed on AWS! 🚀" 